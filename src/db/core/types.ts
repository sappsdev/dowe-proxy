export const BinaryType = {
  NULL: 0x00,
  UNDEFINED: 0x01,
  TRUE: 0x02,
  FALSE: 0x03,
  INT8: 0x10,
  INT16: 0x11,
  INT32: 0x12,
  INT64: 0x13,
  UINT8: 0x14,
  UINT16: 0x15,
  UINT32: 0x16,
  UINT64: 0x17,
  FLOAT32: 0x20,
  FLOAT64: 0x21,
  STRING: 0x30,
  BINARY: 0x31,
  ARRAY: 0x40,
  OBJECT: 0x50,
  DATE: 0x60,
  UUID: 0x70,
} as const;

export type BinaryTypeValue = (typeof BinaryType)[keyof typeof BinaryType];

export interface FileHeader {
  magic: string;
  versionMajor: number;
  versionMinor: number;
  flags: number;
  indexOffset: bigint;
  dataOffset: bigint;
  recordCount: bigint;
}

export interface IndexEntry {
  id: Uint8Array;
  offset: bigint;
  size: number;
  checksum: number;
}

export interface DecodingResult<T = unknown> {
  value: T;
  bytesRead: number;
}

export interface DatabaseOptions {
  path: string;
  initialSize?: number;
  growthFactor?: number;
}

export interface RecordMetadata {
  id: string;
  createdAt: number;
  updatedAt: number;
  size: number;
}

export const MAGIC_BYTES = "DOWE";
export const VERSION_MAJOR = 1;
export const VERSION_MINOR = 0;
export const HEADER_SIZE = 32;
export const UUID_SIZE = 16;
export const INDEX_ENTRY_SIZE = 32;

export const MAX_VARINT_1 = 0x7f;
export const MAX_VARINT_2 = 0x3fff;
export const MAX_VARINT_4 = 0x1fffffff;

export const VARINT_MASK_1 = 0x80;
export const VARINT_MASK_2 = 0xc0;
