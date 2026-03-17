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

  // Pad odd-length input with a trailing 0 so every pair forms a byte
  const padded = cleaned.length % 2 !== 0 ? cleaned + "0" : cleaned;

  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < padded.length; i += 2) {
    bytes[i / 2] = parseInt(padded.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

export function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}
