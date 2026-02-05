import { UUID_SIZE } from "../core/types";

const HEX_CHARS = "0123456789abcdef";
const HEX_LOOKUP: Uint8Array = new Uint8Array(256);

for (let i = 0; i < 16; i++) {
  HEX_LOOKUP[HEX_CHARS.charCodeAt(i)] = i;
  HEX_LOOKUP[HEX_CHARS.toUpperCase().charCodeAt(i)] = i;
}

export function generateUUID(): Uint8Array {
  const bytes = new Uint8Array(UUID_SIZE);
  crypto.getRandomValues(bytes);

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  return bytes;
}

export function uuidToString(bytes: Uint8Array): string {
  const hex: string[] = new Array(36);
  let j = 0;

  for (let i = 0; i < 16; i++) {
    if (i === 4 || i === 6 || i === 8 || i === 10) {
      hex[j++] = "-";
    }
    const byte = bytes[i] ?? 0;
    hex[j++] = HEX_CHARS[byte >> 4] ?? "0";
    hex[j++] = HEX_CHARS[byte & 0x0f] ?? "0";
  }

  return hex.join("");
}

export function stringToUUID(str: string): Uint8Array {
  const bytes = new Uint8Array(UUID_SIZE);
  let byteIndex = 0;

  for (let i = 0; i < str.length && byteIndex < 16; i++) {
    if (str[i] === "-") continue;

    const high = HEX_LOOKUP[str.charCodeAt(i)] ?? 0;
    const low = HEX_LOOKUP[str.charCodeAt(++i)] ?? 0;
    bytes[byteIndex++] = (high << 4) | low;
  }

  return bytes;
}

export function compareUUID(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < UUID_SIZE; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    if (aVal !== bVal) {
      return aVal - bVal;
    }
  }
  return 0;
}
