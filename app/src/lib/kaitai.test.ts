import { describe, it, expect } from "vitest";
import { compileAndParse } from "./kaitai";
import { hexToArrayBuffer } from "./hex";

const simpleKsy = `
meta:
  id: simple_packet
  endian: be
seq:
  - id: magic
    type: u2
  - id: length
    type: u2
  - id: payload
    size: length
  - id: checksum
    type: u1
`;

const tlvKsy = `
meta:
  id: tlv_message
  title: Simple TLV (Type-Length-Value) Protocol
  endian: be
seq:
  - id: magic
    contents: [0x54, 0x4C, 0x56, 0x31]
  - id: version
    type: u1
  - id: num_entries
    type: u2
  - id: entries
    type: entry
    repeat: expr
    repeat-expr: num_entries
types:
  entry:
    seq:
      - id: tag
        type: u1
      - id: length
        type: u2
      - id: value
        size: length
`;

describe("compileAndParse", () => {
  it("parses simple_packet correctly", async () => {
    // magic=0xCAFE, length=4, payload=DEADBEEF, checksum=0xFF
    const buffer = hexToArrayBuffer("CA FE 00 04 DE AD BE EF FF");
    const result = await compileAndParse(simpleKsy, buffer);

    expect(result.success).toBe(true);
    expect(result.tree).toBeDefined();
    expect(result.tree!.type).toBe("object");
    expect(result.tree!.name).toBe("simple_packet");

    const children = result.tree!.children!;
    const magic = children.find((c) => c.name === "magic");
    expect(magic?.value).toBe(0xcafe);
    expect(magic?.hexValue).toBe("0xCAFE");

    const length = children.find((c) => c.name === "length");
    expect(length?.value).toBe(4);

    const payload = children.find((c) => c.name === "payload");
    expect(payload?.type).toBe("bytes");
    expect(payload?.bytesLength).toBe(4);
    expect(payload?.bytesPreview).toBe("de ad be ef");

    const checksum = children.find((c) => c.name === "checksum");
    expect(checksum?.value).toBe(0xff);
  });

  it("parses TLV message with entries", async () => {
    // TLV1 magic + version 1 + 1 entry: tag=4(message), length=5, value="hello"
    const buffer = hexToArrayBuffer(
      "54 4C 56 31 01 00 01 04 00 05 68 65 6C 6C 6F"
    );
    const result = await compileAndParse(tlvKsy, buffer);

    expect(result.success).toBe(true);
    const children = result.tree!.children!;

    const version = children.find((c) => c.name === "version");
    expect(version?.value).toBe(1);

    const entries = children.find((c) => c.name === "entries");
    expect(entries?.type).toBe("array");
    expect(entries?.arrayLength).toBe(1);

    const entry = entries!.children![0];
    expect(entry.type).toBe("object");

    const tag = entry.children!.find((c) => c.name === "tag");
    expect(tag?.value).toBe(4);

    const value = entry.children!.find((c) => c.name === "value");
    expect(value?.type).toBe("bytes");
    expect(value?.bytesLength).toBe(5);
  });

  it("has debug byte ranges", async () => {
    const buffer = hexToArrayBuffer("CA FE 00 04 DE AD BE EF FF");
    const result = await compileAndParse(simpleKsy, buffer);

    const children = result.tree!.children!;
    const magic = children.find((c) => c.name === "magic");
    expect(magic?.range).toEqual({ start: 0, end: 2 });

    const length = children.find((c) => c.name === "length");
    expect(length?.range).toEqual({ start: 2, end: 4 });

    const payload = children.find((c) => c.name === "payload");
    expect(payload?.range).toEqual({ start: 4, end: 8 });

    const checksum = children.find((c) => c.name === "checksum");
    expect(checksum?.range).toEqual({ start: 8, end: 9 });
  });

  it("returns error for invalid YAML", async () => {
    const result = await compileAndParse("not: [valid", new ArrayBuffer(0));
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("returns error for .ksy with imports", async () => {
    const ksyWithImport = `
meta:
  id: test
  imports:
    - common/dos_datetime
seq:
  - id: ts
    type: dos_datetime
`;
    const result = await compileAndParse(ksyWithImport, new ArrayBuffer(8));
    expect(result.success).toBe(false);
    expect(result.error).toContain("Imports are not supported");
  });

  it("returns error for truncated buffer", async () => {
    // simple_packet needs at least 5 bytes header, we give it 2
    const buffer = hexToArrayBuffer("CA FE");
    const result = await compileAndParse(simpleKsy, buffer);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Parse error");
  });
});
