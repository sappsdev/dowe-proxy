import {
  BinaryType,
  MAX_VARINT_1,
  MAX_VARINT_2,
  MAX_VARINT_4,
  UUID_SIZE,
} from "./types";

const TEXT_ENCODER = new TextEncoder();

const INITIAL_BUFFER_SIZE = 4096;
const GROWTH_FACTOR = 2;

export class BinaryEncoder {
  private buffer: ArrayBuffer;
  private view: DataView;
  private bytes: Uint8Array;
  private offset: number;

  constructor(initialSize: number = INITIAL_BUFFER_SIZE) {
    this.buffer = new ArrayBuffer(initialSize);
    this.view = new DataView(this.buffer);
    this.bytes = new Uint8Array(this.buffer);
    this.offset = 0;
  }

  private ensureCapacity(needed: number): void {
    const required = this.offset + needed;
    if (required <= this.buffer.byteLength) return;

    let newSize = this.buffer.byteLength;
    while (newSize < required) {
      newSize *= GROWTH_FACTOR;
    }

    const newBuffer = new ArrayBuffer(newSize);
    const newBytes = new Uint8Array(newBuffer);
    newBytes.set(this.bytes.subarray(0, this.offset));

    this.buffer = newBuffer;
    this.view = new DataView(newBuffer);
    this.bytes = newBytes;
  }

  reset(): void {
    this.offset = 0;
  }

  getBuffer(): Uint8Array {
    return this.bytes.subarray(0, this.offset);
  }

  getSize(): number {
    return this.offset;
  }

  writeUint8(value: number): void {
    this.ensureCapacity(1);
    this.bytes[this.offset++] = value;
  }

  writeUint16(value: number): void {
    this.ensureCapacity(2);
    this.view.setUint16(this.offset, value, false);
    this.offset += 2;
  }

  writeUint32(value: number): void {
    this.ensureCapacity(4);
    this.view.setUint32(this.offset, value, false);
    this.offset += 4;
  }

  writeUint64(value: bigint): void {
    this.ensureCapacity(8);
    this.view.setBigUint64(this.offset, value, false);
    this.offset += 8;
  }

  writeInt8(value: number): void {
    this.ensureCapacity(1);
    this.view.setInt8(this.offset, value);
    this.offset += 1;
  }

  writeInt16(value: number): void {
    this.ensureCapacity(2);
    this.view.setInt16(this.offset, value, false);
    this.offset += 2;
  }

  writeInt32(value: number): void {
    this.ensureCapacity(4);
    this.view.setInt32(this.offset, value, false);
    this.offset += 4;
  }

  writeInt64(value: bigint): void {
    this.ensureCapacity(8);
    this.view.setBigInt64(this.offset, value, false);
    this.offset += 8;
  }

  writeFloat32(value: number): void {
    this.ensureCapacity(4);
    this.view.setFloat32(this.offset, value, false);
    this.offset += 4;
  }

  writeFloat64(value: number): void {
    this.ensureCapacity(8);
    this.view.setFloat64(this.offset, value, false);
    this.offset += 8;
  }

  writeVarint(value: number): void {
    if (value <= MAX_VARINT_1) {
      this.ensureCapacity(1);
      this.bytes[this.offset++] = value;
    } else if (value <= MAX_VARINT_2) {
      this.ensureCapacity(2);
      this.bytes[this.offset++] = 0x80 | (value >> 8);
      this.bytes[this.offset++] = value & 0xff;
    } else if (value <= MAX_VARINT_4) {
      this.ensureCapacity(4);
      this.bytes[this.offset++] = 0xc0 | (value >> 24);
      this.bytes[this.offset++] = (value >> 16) & 0xff;
      this.bytes[this.offset++] = (value >> 8) & 0xff;
      this.bytes[this.offset++] = value & 0xff;
    } else {
      throw new Error("Value too large for varint encoding");
    }
  }

  writeBytes(data: Uint8Array): void {
    this.ensureCapacity(data.length);
    this.bytes.set(data, this.offset);
    this.offset += data.length;
  }

  encodeValue(value: unknown): void {
    if (value === null) {
      this.writeUint8(BinaryType.NULL);
      return;
    }

    if (value === undefined) {
      this.writeUint8(BinaryType.UNDEFINED);
      return;
    }

    if (typeof value === "boolean") {
      this.writeUint8(value ? BinaryType.TRUE : BinaryType.FALSE);
      return;
    }

    if (typeof value === "number") {
      this.encodeNumber(value);
      return;
    }

    if (typeof value === "bigint") {
      this.encodeBigInt(value);
      return;
    }

    if (typeof value === "string") {
      this.encodeString(value);
      return;
    }

    if (value instanceof Uint8Array) {
      this.encodeBinary(value);
      return;
    }

    if (value instanceof Date) {
      this.encodeDate(value);
      return;
    }

    if (Array.isArray(value)) {
      this.encodeArray(value);
      return;
    }

    if (typeof value === "object") {
      this.encodeObject(value as Record<string, unknown>);
      return;
    }

    throw new Error(`Unsupported type: ${typeof value}`);
  }

  private encodeNumber(value: number): void {
    if (Number.isInteger(value)) {
      if (value >= -128 && value <= 127) {
        this.writeUint8(BinaryType.INT8);
        this.writeInt8(value);
      } else if (value >= -32768 && value <= 32767) {
        this.writeUint8(BinaryType.INT16);
        this.writeInt16(value);
      } else if (value >= -2147483648 && value <= 2147483647) {
        this.writeUint8(BinaryType.INT32);
        this.writeInt32(value);
      } else {
        this.writeUint8(BinaryType.FLOAT64);
        this.writeFloat64(value);
      }
    } else {
      const float32 = Math.fround(value);
      if (float32 === value) {
        this.writeUint8(BinaryType.FLOAT32);
        this.writeFloat32(value);
      } else {
        this.writeUint8(BinaryType.FLOAT64);
        this.writeFloat64(value);
      }
    }
  }

  private encodeBigInt(value: bigint): void {
    if (value >= 0n) {
      this.writeUint8(BinaryType.UINT64);
      this.writeUint64(value);
    } else {
      this.writeUint8(BinaryType.INT64);
      this.writeInt64(value);
    }
  }

  private encodeString(value: string): void {
    const encoded = TEXT_ENCODER.encode(value);
    this.writeUint8(BinaryType.STRING);
    this.writeVarint(encoded.length);
    this.writeBytes(encoded);
  }

  private encodeBinary(value: Uint8Array): void {
    this.writeUint8(BinaryType.BINARY);
    this.writeVarint(value.length);
    this.writeBytes(value);
  }

  private encodeDate(value: Date): void {
    this.writeUint8(BinaryType.DATE);
    this.writeInt64(BigInt(value.getTime()));
  }

  private encodeArray(value: unknown[]): void {
    this.writeUint8(BinaryType.ARRAY);
    this.writeVarint(value.length);

    for (let i = 0; i < value.length; i++) {
      this.encodeValue(value[i]);
    }
  }

  private encodeObject(value: Record<string, unknown>): void {
    const keys = Object.keys(value);
    this.writeUint8(BinaryType.OBJECT);
    this.writeVarint(keys.length);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key !== undefined) {
        this.encodeString(key);
        this.encodeValue(value[key]);
      }
    }
  }

  encodeUUID(value: Uint8Array): void {
    if (value.length !== UUID_SIZE) {
      throw new Error("UUID must be 16 bytes");
    }
    this.writeUint8(BinaryType.UUID);
    this.writeBytes(value);
  }
}

export function encode(value: unknown): Uint8Array {
  const encoder = new BinaryEncoder();
  encoder.encodeValue(value);
  return encoder.getBuffer().slice();
}

const sharedEncoder = new BinaryEncoder(65536);

export function encodeFast(value: unknown): Uint8Array {
  sharedEncoder.reset();
  sharedEncoder.encodeValue(value);
  return sharedEncoder.getBuffer().slice();
}
