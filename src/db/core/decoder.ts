import { BinaryType, type DecodingResult, UUID_SIZE } from "./types";

const TEXT_DECODER = new TextDecoder();

export class BinaryDecoder {
  private view: DataView;
  private bytes: Uint8Array;
  private offset: number;
  private length: number;

  constructor(buffer: Uint8Array) {
    this.bytes = buffer;
    this.view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    this.offset = 0;
    this.length = buffer.length;
  }

  getOffset(): number {
    return this.offset;
  }

  setOffset(offset: number): void {
    this.offset = offset;
  }

  hasMore(): boolean {
    return this.offset < this.length;
  }

  remaining(): number {
    return this.length - this.offset;
  }

  readUint8(): number {
    if (this.offset >= this.length) {
      throw new Error("Buffer underflow");
    }
    const value = this.bytes[this.offset++];
    return value ?? 0;
  }

  readUint16(): number {
    if (this.offset + 2 > this.length) {
      throw new Error("Buffer underflow");
    }
    const value = this.view.getUint16(this.offset, false);
    this.offset += 2;
    return value;
  }

  readUint32(): number {
    if (this.offset + 4 > this.length) {
      throw new Error("Buffer underflow");
    }
    const value = this.view.getUint32(this.offset, false);
    this.offset += 4;
    return value;
  }

  readUint64(): bigint {
    if (this.offset + 8 > this.length) {
      throw new Error("Buffer underflow");
    }
    const value = this.view.getBigUint64(this.offset, false);
    this.offset += 8;
    return value;
  }

  readInt8(): number {
    if (this.offset >= this.length) {
      throw new Error("Buffer underflow");
    }
    const value = this.view.getInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readInt16(): number {
    if (this.offset + 2 > this.length) {
      throw new Error("Buffer underflow");
    }
    const value = this.view.getInt16(this.offset, false);
    this.offset += 2;
    return value;
  }

  readInt32(): number {
    if (this.offset + 4 > this.length) {
      throw new Error("Buffer underflow");
    }
    const value = this.view.getInt32(this.offset, false);
    this.offset += 4;
    return value;
  }

  readInt64(): bigint {
    if (this.offset + 8 > this.length) {
      throw new Error("Buffer underflow");
    }
    const value = this.view.getBigInt64(this.offset, false);
    this.offset += 8;
    return value;
  }

  readFloat32(): number {
    if (this.offset + 4 > this.length) {
      throw new Error("Buffer underflow");
    }
    const value = this.view.getFloat32(this.offset, false);
    this.offset += 4;
    return value;
  }

  readFloat64(): number {
    if (this.offset + 8 > this.length) {
      throw new Error("Buffer underflow");
    }
    const value = this.view.getFloat64(this.offset, false);
    this.offset += 8;
    return value;
  }

  readVarint(): number {
    const first = this.readUint8();

    if ((first & 0x80) === 0) {
      return first;
    }

    if ((first & 0xc0) === 0x80) {
      const second = this.readUint8();
      return ((first & 0x3f) << 8) | second;
    }

    if ((first & 0xe0) === 0xc0) {
      const b1 = this.readUint8();
      const b2 = this.readUint8();
      const b3 = this.readUint8();
      return ((first & 0x1f) << 24) | (b1 << 16) | (b2 << 8) | b3;
    }

    throw new Error("Invalid varint encoding");
  }

  readBytes(length: number): Uint8Array {
    if (this.offset + length > this.length) {
      throw new Error("Buffer underflow");
    }
    const slice = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  decodeValue(): unknown {
    const type = this.readUint8();

    switch (type) {
      case BinaryType.NULL:
        return null;

      case BinaryType.UNDEFINED:
        return undefined;

      case BinaryType.TRUE:
        return true;

      case BinaryType.FALSE:
        return false;

      case BinaryType.INT8:
        return this.readInt8();

      case BinaryType.INT16:
        return this.readInt16();

      case BinaryType.INT32:
        return this.readInt32();

      case BinaryType.INT64:
        return this.readInt64();

      case BinaryType.UINT8:
        return this.readUint8();

      case BinaryType.UINT16:
        return this.readUint16();

      case BinaryType.UINT32:
        return this.readUint32();

      case BinaryType.UINT64:
        return this.readUint64();

      case BinaryType.FLOAT32:
        return this.readFloat32();

      case BinaryType.FLOAT64:
        return this.readFloat64();

      case BinaryType.STRING:
        return this.decodeString();

      case BinaryType.BINARY:
        return this.decodeBinary();

      case BinaryType.ARRAY:
        return this.decodeArray();

      case BinaryType.OBJECT:
        return this.decodeObject();

      case BinaryType.DATE:
        return this.decodeDate();

      case BinaryType.UUID:
        return this.decodeUUID();

      default:
        throw new Error(`Unknown type: 0x${type.toString(16)}`);
    }
  }

  private decodeString(): string {
    const length = this.readVarint();
    const bytes = this.readBytes(length);
    return TEXT_DECODER.decode(bytes);
  }

  private decodeBinary(): Uint8Array {
    const length = this.readVarint();
    return this.readBytes(length).slice();
  }

  private decodeArray(): unknown[] {
    const length = this.readVarint();
    const result = new Array(length);

    for (let i = 0; i < length; i++) {
      result[i] = this.decodeValue();
    }

    return result;
  }

  private decodeObject(): Record<string, unknown> {
    const length = this.readVarint();
    const result: Record<string, unknown> = {};

    for (let i = 0; i < length; i++) {
      const keyType = this.readUint8();
      if (keyType !== BinaryType.STRING) {
        throw new Error("Object keys must be strings");
      }
      const key = this.decodeString();
      const value = this.decodeValue();
      result[key] = value;
    }

    return result;
  }

  private decodeDate(): Date {
    const timestamp = this.readInt64();
    return new Date(Number(timestamp));
  }

  private decodeUUID(): Uint8Array {
    return this.readBytes(UUID_SIZE).slice();
  }
}

export function decode(buffer: Uint8Array): unknown {
  const decoder = new BinaryDecoder(buffer);
  return decoder.decodeValue();
}

export function decodeWithResult<T = unknown>(
  buffer: Uint8Array,
): DecodingResult<T> {
  const decoder = new BinaryDecoder(buffer);
  const value = decoder.decodeValue() as T;
  return {
    value,
    bytesRead: decoder.getOffset(),
  };
}

export function decodeAt<T = unknown>(
  buffer: Uint8Array,
  offset: number,
): DecodingResult<T> {
  const decoder = new BinaryDecoder(buffer);
  decoder.setOffset(offset);
  const startOffset = offset;
  const value = decoder.decodeValue() as T;
  return {
    value,
    bytesRead: decoder.getOffset() - startOffset,
  };
}
