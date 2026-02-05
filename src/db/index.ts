export { BinaryType } from "./core/types";
export type {
  FileHeader,
  IndexEntry,
  DecodingResult,
  DatabaseOptions,
  RecordMetadata,
} from "./core/types";

export { BinaryEncoder, encode, encodeFast } from "./core/encoder";
export {
  BinaryDecoder,
  decode,
  decodeWithResult,
  decodeAt,
} from "./core/decoder";

export { BTreeIndex, IndexManager } from "./core/index";
export type { RecordLocation } from "./core/index";

export { Storage, createStorage, openStorage } from "./core/storage";
export type { StorageOptions, WriteResult } from "./core/storage";

export { crc32 } from "./utils/checksum";
export {
  generateUUID,
  uuidToString,
  stringToUUID,
  compareUUID,
} from "./utils/uuid";
