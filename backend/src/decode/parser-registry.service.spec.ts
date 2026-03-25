import { ParserRegistryService } from './parser-registry.service';

const SIMPLE_KSY = `
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

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const clean = hex.replace(/\s+/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer as ArrayBuffer;
}

describe('ParserRegistryService', () => {
  let service: ParserRegistryService;

  beforeEach(() => {
    service = new ParserRegistryService();
  });

  describe('register', () => {
    it('should compile and register a valid .ksy file', async () => {
      const id = await service.register('/simple.ksy', SIMPLE_KSY);
      expect(id).toBe('simple_packet');
      expect(service.getAll()).toHaveLength(1);
      expect(service.getAll()[0].id).toBe('simple_packet');
    });

    it('should return null for invalid YAML', async () => {
      const id = await service.register('/bad.ksy', ':::invalid yaml:::');
      expect(id).toBeNull();
      expect(service.getAll()).toHaveLength(0);
    });

    it('should return null for YAML without meta.id', async () => {
      const id = await service.register('/no-id.ksy', 'seq:\n  - id: x\n    type: u1');
      expect(id).toBeNull();
    });

    it('should return null for non-object YAML', async () => {
      const id = await service.register('/scalar.ksy', '"just a string"');
      expect(id).toBeNull();
    });

    it('should overwrite an existing parser with the same meta.id', async () => {
      await service.register('/v1.ksy', SIMPLE_KSY);
      await service.register('/v2.ksy', SIMPLE_KSY);
      expect(service.getAll()).toHaveLength(1);
      expect(service.getAll()[0].ksyPath).toBe('/v2.ksy');
    });

    it('should return null for invalid ksy that fails compilation', async () => {
      const badKsy = `
meta:
  id: broken
seq:
  - id: x
    type: nonexistent_type
`;
      const id = await service.register('/broken.ksy', badKsy);
      expect(id).toBeNull();
    });
  });

  describe('removeByPath', () => {
    it('should remove a parser by its .ksy path', async () => {
      await service.register('/simple.ksy', SIMPLE_KSY);
      expect(service.getAll()).toHaveLength(1);
      service.removeByPath('/simple.ksy');
      expect(service.getAll()).toHaveLength(0);
    });

    it('should do nothing if path does not match any parser', () => {
      service.removeByPath('/nonexistent.ksy');
      expect(service.getAll()).toHaveLength(0);
    });
  });

  describe('getAll', () => {
    it('should return an empty array initially', () => {
      expect(service.getAll()).toEqual([]);
    });

    it('should return all registered parsers', async () => {
      await service.register('/simple.ksy', SIMPLE_KSY);
      const anotherKsy = `
meta:
  id: tiny
  endian: le
seq:
  - id: val
    type: u1
`;
      await service.register('/tiny.ksy', anotherKsy);
      const all = service.getAll();
      expect(all).toHaveLength(2);
      expect(all.map((p) => p.id).sort()).toEqual(['simple_packet', 'tiny']);
    });
  });

  describe('parseWith', () => {
    it('should successfully parse matching binary data', async () => {
      await service.register('/simple.ksy', SIMPLE_KSY);
      const parser = service.getAll()[0];
      // CAFE 0004 DEADBEEF FF
      const buffer = hexToArrayBuffer('cafe0004deadbeefff');
      const result = service.parseWith(parser, buffer);

      expect(result.success).toBe(true);
      expect(result.tree).toBeDefined();
      expect(result.tree!.name).toBe('simple_packet');
      expect(result.tree!.type).toBe('object');
      expect(result.tree!.children).toHaveLength(4);

      const [magic, length, payload, checksum] = result.tree!.children!;
      expect(magic.name).toBe('magic');
      expect(magic.value).toBe(0xcafe);
      expect(magic.hexValue).toBe('0xCAFE');
      expect(magic.range).toEqual({ start: 0, end: 2 });

      expect(length.value).toBe(4);
      expect(payload.type).toBe('bytes');
      expect(payload.bytesLength).toBe(4);
      expect(payload.bytesPreview).toBe('de ad be ef');
      expect(checksum.value).toBe(0xff);
    });

    it('should return an error for data that does not match the parser', async () => {
      await service.register('/simple.ksy', SIMPLE_KSY);
      const parser = service.getAll()[0];
      // Too short — length says 4 bytes but only 1 byte of payload
      const buffer = hexToArrayBuffer('cafe000401');
      const result = service.parseWith(parser, buffer);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should include byte ranges from debug info', async () => {
      await service.register('/simple.ksy', SIMPLE_KSY);
      const parser = service.getAll()[0];
      const buffer = hexToArrayBuffer('cafe0004deadbeefff');
      const result = service.parseWith(parser, buffer);

      expect(result.tree!.range).toEqual({ start: 0, end: 9 });
    });
  });
});
