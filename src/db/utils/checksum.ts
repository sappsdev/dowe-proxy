const CRC32_TABLE: Uint32Array = new Uint32Array(256);

for (let i = 0; i < 256; i++) {
  let crc = i;
  for (let j = 0; j < 8; j++) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  CRC32_TABLE[i] = crc >>> 0;
}

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  const len = data.length;

  for (let i = 0; i < len; i++) {
    crc = (CRC32_TABLE[(crc ^ data[i]!) & 0xff] ?? 0) ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

export function crc32Combine(crc1: number, crc2: number, len2: number): number {
  let crc = crc1;

  for (let i = 0; i < len2; i++) {
    crc =
      (CRC32_TABLE[(crc ^ ((crc2 >>> (i * 8)) & 0xff)) & 0xff] ?? 0) ^
      (crc >>> 8);
  }

  return crc >>> 0;
}
