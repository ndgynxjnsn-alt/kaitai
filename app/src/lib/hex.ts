/**
 * Parse a hex string into an ArrayBuffer.
 * Accepts formats: "AB CD EF", "ABCDEF", "0xAB 0xCD", "AB:CD:EF"
 */
export function hexToArrayBuffer(hex: string): ArrayBuffer {
  const cleaned = hex
    .replace(/0x/gi, "")
    .replace(/[^0-9a-fA-F]/g, "");

  if (cleaned.length === 0) {
    throw new Error("No hex data found in input");
  }
  if (cleaned.length % 2 !== 0) {
    throw new Error("Hex string has odd length — each byte needs two hex digits");
  }

  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

export function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}
