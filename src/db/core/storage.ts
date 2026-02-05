import {
  type FileHeader,
  HEADER_SIZE,
  MAGIC_BYTES,
  VERSION_MAJOR,
  VERSION_MINOR,
  UUID_SIZE,
} from "./types";
import { BinaryEncoder } from "./encoder";
import { BinaryDecoder } from "./decoder";
import { IndexManager, type RecordLocation } from "./index";
import { crc32 } from "../utils/checksum";
import { generateUUID, uuidToString, stringToUUID } from "../utils/uuid";

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

export interface StorageOptions {
  path: string;
  create?: boolean;
}

export interface WriteResult {
  id: string;
  offset: bigint;
  size: number;
}

export class Storage {
  private path: string;
  private file: ReturnType<typeof Bun.file> | null;
  private indexManager: IndexManager;
  private header: FileHeader;
  private dataOffset: bigint;
  private encoder: BinaryEncoder;

  constructor(path: string) {
    this.path = path;
    this.file = null;
    this.indexManager = new IndexManager();
    this.encoder = new BinaryEncoder(65536);
    this.header = {
      magic: MAGIC_BYTES,
      versionMajor: VERSION_MAJOR,
      versionMinor: VERSION_MINOR,
      flags: 0,
      indexOffset: 0n,
      dataOffset: BigInt(HEADER_SIZE),
      recordCount: 0n,
    };
    this.dataOffset = BigInt(HEADER_SIZE);
  }

  async open(options: StorageOptions = { path: this.path }): Promise<void> {
    this.file = Bun.file(this.path);
    const exists = await this.file.exists();

    if (exists) {
      await this.loadDatabase();
    } else if (options.create !== false) {
      await this.createDatabase();
    } else {
      throw new Error(`Database not found: ${this.path}`);
    }
  }

  private async createDatabase(): Promise<void> {
    const headerBuffer = this.serializeHeader();
    await Bun.write(this.path, headerBuffer);
    this.dataOffset = BigInt(HEADER_SIZE);
  }

  private async loadDatabase(): Promise<void> {
    const headerBytes = await this.file!.slice(0, HEADER_SIZE).arrayBuffer();
    const header = new Uint8Array(headerBytes);
    this.header = this.deserializeHeader(header);

    if (this.header.magic !== MAGIC_BYTES) {
      throw new Error("Invalid database file");
    }

    if (this.header.indexOffset > 0n) {
      await this.loadIndex();
    }

    this.dataOffset = this.header.dataOffset;
  }

  private serializeHeader(): Uint8Array {
    const buffer = new ArrayBuffer(HEADER_SIZE);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    const magicBytes = TEXT_ENCODER.encode(MAGIC_BYTES);
    bytes.set(magicBytes, 0);

    view.setUint8(4, this.header.versionMajor);
    view.setUint8(5, this.header.versionMinor);
    view.setUint16(6, this.header.flags, false);
    view.setBigUint64(8, this.header.indexOffset, false);
    view.setBigUint64(16, this.header.dataOffset, false);
    view.setBigUint64(24, this.header.recordCount, false);

    return bytes;
  }

  private deserializeHeader(buffer: Uint8Array): FileHeader {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );

    return {
      magic: TEXT_DECODER.decode(buffer.subarray(0, 4)),
      versionMajor: view.getUint8(4),
      versionMinor: view.getUint8(5),
      flags: view.getUint16(6, false),
      indexOffset: view.getBigUint64(8, false),
      dataOffset: view.getBigUint64(16, false),
      recordCount: view.getBigUint64(24, false),
    };
  }

  private async loadIndex(): Promise<void> {
    const indexStart = Number(this.header.indexOffset);
    const fileSize = this.file!.size;
    const indexBytes = await this.file!.slice(
      indexStart,
      fileSize,
    ).arrayBuffer();
    const indexBuffer = new Uint8Array(indexBytes);

    const decoder = new BinaryDecoder(indexBuffer);

    while (decoder.hasMore()) {
      const id = decoder.readBytes(UUID_SIZE);
      const offset = decoder.readUint64();
      const size = decoder.readUint32();
      const checksum = decoder.readUint32();

      this.indexManager.setRecord(id.slice(), {
        offset,
        size,
        checksum,
      });
    }
  }

  async write(data: unknown): Promise<WriteResult> {
    this.encoder.reset();
    this.encoder.encodeValue(data);
    const encoded = this.encoder.getBuffer();

    const checksum = crc32(encoded);
    const id = generateUUID();
    const offset = this.dataOffset;
    const size = encoded.length;

    const recordBuffer = new Uint8Array(UUID_SIZE + 4 + size);
    recordBuffer.set(id, 0);
    new DataView(recordBuffer.buffer).setUint32(UUID_SIZE, size, false);
    recordBuffer.set(encoded, UUID_SIZE + 4);

    const fileHandle = Bun.file(this.path);
    const existingContent = await fileHandle.arrayBuffer();
    const existingBytes = new Uint8Array(existingContent);

    const newSize = Number(offset) + recordBuffer.length;
    const newContent = new Uint8Array(newSize);
    newContent.set(existingBytes.subarray(0, Number(offset)));
    newContent.set(recordBuffer, Number(offset));

    await Bun.write(this.path, newContent);

    this.indexManager.setRecord(id, {
      offset,
      size,
      checksum,
    });

    this.dataOffset += BigInt(recordBuffer.length);
    this.header.recordCount++;
    this.header.dataOffset = this.dataOffset;

    return {
      id: uuidToString(id),
      offset,
      size,
    };
  }

  async read(id: string): Promise<unknown | null> {
    const idBytes = stringToUUID(id);
    const location = this.indexManager.getRecord(idBytes);

    if (!location) {
      return null;
    }

    this.file = Bun.file(this.path);

    const recordStart = Number(location.offset) + UUID_SIZE + 4;
    const recordEnd = recordStart + location.size;

    const recordBytes = await this.file
      .slice(recordStart, recordEnd)
      .arrayBuffer();
    const recordBuffer = new Uint8Array(recordBytes);

    const checksum = crc32(recordBuffer);
    if (checksum !== location.checksum) {
      throw new Error("Checksum mismatch - data corruption detected");
    }

    const decoder = new BinaryDecoder(recordBuffer);
    return decoder.decodeValue();
  }

  async delete(id: string): Promise<boolean> {
    const idBytes = stringToUUID(id);
    const deleted = this.indexManager.deleteRecord(idBytes);

    if (deleted) {
      this.header.recordCount--;
    }

    return deleted;
  }

  async flush(): Promise<void> {
    await this.persistIndex();
    await this.persistHeader();
  }

  private async persistIndex(): Promise<void> {
    const entries = Array.from(this.indexManager.entries());
    const indexSize = entries.length * (UUID_SIZE + 8 + 4 + 4);
    const indexBuffer = new Uint8Array(indexSize);
    const view = new DataView(indexBuffer.buffer);

    let offset = 0;
    for (const [id, location] of entries) {
      indexBuffer.set(id, offset);
      view.setBigUint64(offset + UUID_SIZE, location.offset, false);
      view.setUint32(offset + UUID_SIZE + 8, location.size, false);
      view.setUint32(offset + UUID_SIZE + 12, location.checksum, false);
      offset += UUID_SIZE + 16;
    }

    this.header.indexOffset = this.dataOffset;

    const fileHandle = Bun.file(this.path);
    const existingContent = await fileHandle.arrayBuffer();
    const existingBytes = new Uint8Array(existingContent);

    const newSize = Number(this.dataOffset) + indexBuffer.length;
    const newContent = new Uint8Array(newSize);
    newContent.set(existingBytes.subarray(0, Number(this.dataOffset)));
    newContent.set(indexBuffer, Number(this.dataOffset));

    await Bun.write(this.path, newContent);
  }

  private async persistHeader(): Promise<void> {
    const headerBuffer = this.serializeHeader();

    const fileHandle = Bun.file(this.path);
    const existingContent = await fileHandle.arrayBuffer();
    const existingBytes = new Uint8Array(existingContent);

    existingBytes.set(headerBuffer, 0);
    await Bun.write(this.path, existingBytes);
  }

  async compact(): Promise<void> {
    const entries = Array.from(this.indexManager.entries());
    const tempPath = `${this.path}.tmp`;

    const newStorage = new Storage(tempPath);
    await newStorage.open({ path: tempPath, create: true });

    for (const [id, location] of entries) {
      const recordStart = Number(location.offset) + UUID_SIZE + 4;
      const recordEnd = recordStart + location.size;
      const recordBytes = await this.file!.slice(
        recordStart,
        recordEnd,
      ).arrayBuffer();
      const recordBuffer = new Uint8Array(recordBytes);

      const decoder = new BinaryDecoder(recordBuffer);
      const data = decoder.decodeValue();
      await newStorage.write(data);
    }

    await newStorage.flush();
    await newStorage.close();

    const fs = await import("node:fs/promises");
    await fs.rename(tempPath, this.path);

    await this.open();
  }

  async close(): Promise<void> {
    await this.flush();
    this.file = null;
    this.indexManager.clear();
  }

  getRecordCount(): number {
    return Number(this.header.recordCount);
  }

  getIndexManager(): IndexManager {
    return this.indexManager;
  }
}

export async function createStorage(path: string): Promise<Storage> {
  const storage = new Storage(path);
  await storage.open({ path, create: true });
  return storage;
}

export async function openStorage(path: string): Promise<Storage> {
  const storage = new Storage(path);
  await storage.open({ path, create: false });
  return storage;
}
