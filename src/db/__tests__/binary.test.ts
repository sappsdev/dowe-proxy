import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { encode, encodeFast, BinaryEncoder } from "../core/encoder";
import { decode, BinaryDecoder } from "../core/decoder";
import { crc32 } from "../utils/checksum";
import {
  generateUUID,
  uuidToString,
  stringToUUID,
  compareUUID,
} from "../utils/uuid";
import { createStorage } from "../core/storage";
import { unlink } from "node:fs/promises";

describe("Binary Encoder/Decoder", () => {
  test("encode/decode null", () => {
    const encoded = encode(null);
    const decoded = decode(encoded);
    expect(decoded).toBe(null);
  });

  test("encode/decode undefined", () => {
    const encoded = encode(undefined);
    const decoded = decode(encoded);
    expect(decoded).toBe(undefined);
  });

  test("encode/decode booleans", () => {
    expect(decode(encode(true))).toBe(true);
    expect(decode(encode(false))).toBe(false);
  });

  test("encode/decode integers", () => {
    expect(decode(encode(0))).toBe(0);
    expect(decode(encode(127))).toBe(127);
    expect(decode(encode(-128))).toBe(-128);
    expect(decode(encode(32767))).toBe(32767);
    expect(decode(encode(-32768))).toBe(-32768);
    expect(decode(encode(2147483647))).toBe(2147483647);
    expect(decode(encode(-2147483648))).toBe(-2147483648);
  });

  test("encode/decode floats", () => {
    expect(decode(encode(3.14159265359))).toBeCloseTo(3.14159265359);
    expect(decode(encode(-0.5))).toBe(-0.5);
    expect(decode(encode(1.5))).toBe(1.5);
  });

  test("encode/decode bigints", () => {
    expect(decode(encode(9007199254740993n))).toBe(9007199254740993n);
    expect(decode(encode(-9007199254740993n))).toBe(-9007199254740993n);
  });

  test("encode/decode strings", () => {
    expect(decode(encode(""))).toBe("");
    expect(decode(encode("hello"))).toBe("hello");
    expect(decode(encode("Hello, 世界! 🌍"))).toBe("Hello, 世界! 🌍");

    const longString = "a".repeat(10000);
    expect(decode(encode(longString))).toBe(longString);
  });

  test("encode/decode binary", () => {
    const binary = new Uint8Array([1, 2, 3, 4, 5]);
    const decoded = decode(encode(binary)) as Uint8Array;
    expect(decoded).toEqual(binary);
  });

  test("encode/decode dates", () => {
    const date = new Date("2026-01-21T12:00:00Z");
    const decoded = decode(encode(date)) as Date;
    expect(decoded.getTime()).toBe(date.getTime());
  });

  test("encode/decode arrays", () => {
    expect(decode(encode([]))).toEqual([]);
    expect(decode(encode([1, 2, 3]))).toEqual([1, 2, 3]);
    expect(decode(encode(["a", "b", "c"]))).toEqual(["a", "b", "c"]);
    expect(decode(encode([1, "two", true, null]))).toEqual([
      1,
      "two",
      true,
      null,
    ]);
  });

  test("encode/decode objects", () => {
    expect(decode(encode({}))).toEqual({});
    expect(decode(encode({ a: 1, b: 2 }))).toEqual({ a: 1, b: 2 });
    expect(decode(encode({ nested: { deep: { value: 42 } } }))).toEqual({
      nested: { deep: { value: 42 } },
    });
  });

  test("encode/decode complex data", () => {
    const data = {
      id: "test-123",
      count: 42,
      active: true,
      score: 98.5,
      tags: ["alpha", "beta", "gamma"],
      metadata: {
        created: new Date("2026-01-01"),
        updated: null,
      },
    };

    const decoded = decode(encode(data)) as typeof data;
    expect(decoded.id).toBe(data.id);
    expect(decoded.count).toBe(data.count);
    expect(decoded.active).toBe(data.active);
    expect(decoded.score).toBe(data.score);
    expect(decoded.tags).toEqual(data.tags);
    expect(decoded.metadata.updated).toBe(null);
  });

  test("encodeFast uses shared buffer", () => {
    const data1 = { test: 1 };
    const data2 = { test: 2 };

    const encoded1 = encodeFast(data1);
    const encoded2 = encodeFast(data2);

    expect(decode(encoded1)).toEqual(data1);
    expect(decode(encoded2)).toEqual(data2);
  });
});

describe("CRC32 Checksum", () => {
  test("compute checksum", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const checksum = crc32(data);
    expect(typeof checksum).toBe("number");
    expect(checksum).toBeGreaterThan(0);
  });

  test("same data produces same checksum", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    expect(crc32(data)).toBe(crc32(data));
  });

  test("different data produces different checksum", () => {
    const data1 = new Uint8Array([1, 2, 3, 4, 5]);
    const data2 = new Uint8Array([1, 2, 3, 4, 6]);
    expect(crc32(data1)).not.toBe(crc32(data2));
  });
});

describe("UUID", () => {
  test("generate UUID", () => {
    const uuid = generateUUID();
    expect(uuid.length).toBe(16);
  });

  test("UUID to string and back", () => {
    const uuid = generateUUID();
    const str = uuidToString(uuid);
    const parsed = stringToUUID(str);

    expect(str).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(compareUUID(uuid, parsed)).toBe(0);
  });

  test("UUIDs are unique", () => {
    const uuid1 = generateUUID();
    const uuid2 = generateUUID();
    expect(compareUUID(uuid1, uuid2)).not.toBe(0);
  });
});

describe("Storage", () => {
  const testDbPath = "/tmp/test-dowe.db";

  afterEach(async () => {
    try {
      await unlink(testDbPath);
    } catch {}
  });

  test("create and open database", async () => {
    const storage = await createStorage(testDbPath);
    expect(storage.getRecordCount()).toBe(0);
    await storage.close();
  });

  test("write and read record", async () => {
    const storage = await createStorage(testDbPath);

    const data = { name: "test", value: 42 };
    const result = await storage.write(data);

    expect(result.id).toBeDefined();
    expect(result.size).toBeGreaterThan(0);

    const retrieved = await storage.read(result.id);
    expect(retrieved).toEqual(data);

    await storage.close();
  });

  test("write multiple records", async () => {
    const storage = await createStorage(testDbPath);

    const ids: string[] = [];
    for (let i = 0; i < 100; i++) {
      const result = await storage.write({ index: i, data: `item-${i}` });
      ids.push(result.id);
    }

    expect(storage.getRecordCount()).toBe(100);

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      const record = (await storage.read(id)) as {
        index: number;
        data: string;
      };
      expect(record.index).toBe(i);
    }

    await storage.close();
  });

  test("delete record", async () => {
    const storage = await createStorage(testDbPath);

    const result = await storage.write({ test: true });
    expect(await storage.read(result.id)).toEqual({ test: true });

    const deleted = await storage.delete(result.id);
    expect(deleted).toBe(true);
    expect(await storage.read(result.id)).toBe(null);

    await storage.close();
  });

  test("persistence after close", async () => {
    let id: string;

    {
      const storage = await createStorage(testDbPath);
      const result = await storage.write({ persistent: true });
      id = result.id;
      await storage.close();
    }

    {
      const storage = await createStorage(testDbPath);
      const data = await storage.read(id);
      expect(data).toEqual({ persistent: true });
      await storage.close();
    }
  });
});

describe("Performance Benchmarks", () => {
  test("encode performance", () => {
    const data = {
      id: "benchmark-test",
      numbers: Array.from({ length: 100 }, (_, i) => i),
      strings: Array.from({ length: 100 }, (_, i) => `string-${i}`),
      nested: { a: { b: { c: { d: 1 } } } },
    };

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      encodeFast(data);
    }

    const duration = performance.now() - start;
    const opsPerSec = Math.floor(iterations / (duration / 1000));

    console.log(`Encode: ${opsPerSec.toLocaleString()} ops/sec`);
    expect(opsPerSec).toBeGreaterThan(10000);
  });

  test("decode performance", () => {
    const data = {
      id: "benchmark-test",
      numbers: Array.from({ length: 100 }, (_, i) => i),
      strings: Array.from({ length: 100 }, (_, i) => `string-${i}`),
      nested: { a: { b: { c: { d: 1 } } } },
    };

    const encoded = encode(data);
    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      decode(encoded);
    }

    const duration = performance.now() - start;
    const opsPerSec = Math.floor(iterations / (duration / 1000));

    console.log(`Decode: ${opsPerSec.toLocaleString()} ops/sec`);
    expect(opsPerSec).toBeGreaterThan(10000);
  });

  test("binary vs JSON size comparison", () => {
    const data = {
      id: "size-comparison",
      numbers: Array.from({ length: 50 }, (_, i) => i * 1000),
      strings: Array.from({ length: 20 }, (_, i) => `value-${i}`),
      flags: [true, false, true, true, false],
    };

    const binarySize = encode(data).length;
    const jsonSize = new TextEncoder().encode(JSON.stringify(data)).length;

    console.log(`Binary: ${binarySize} bytes, JSON: ${jsonSize} bytes`);
    console.log(
      `Binary is ${((1 - binarySize / jsonSize) * 100).toFixed(1)}% smaller`,
    );
  });
});
