import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DecodeController } from './decode.controller';
import { S3Service } from '../files/s3.service';
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

describe('DecodeController (integration)', () => {
  let app: INestApplication;
  let registry: ParserRegistryService;
  let mockS3: { get: jest.Mock; put: jest.Mock; list: jest.Mock; delete: jest.Mock };

  beforeAll(async () => {
    mockS3 = {
      get: jest.fn(),
      put: jest.fn(),
      list: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DecodeController],
      providers: [
        { provide: S3Service, useValue: mockS3 },
        ParserRegistryService,
      ],
    }).compile();

    app = module.createNestApplication();
    registry = module.get(ParserRegistryService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 when file field is missing', async () => {
    const res = await request(app.getHttpServer())
      .post('/decode')
      .send({});

    expect(res.status).toBe(400);
  });

  it('should return 404 when file does not exist in S3', async () => {
    mockS3.get.mockResolvedValue(null);

    const res = await request(app.getHttpServer())
      .post('/decode')
      .send({ file: '/nonexistent.bin' });

    expect(res.status).toBe(404);
  });

  it('should return empty parsers array when no parsers are registered', async () => {
    mockS3.get.mockResolvedValue('cafe0004deadbeefff');

    const res = await request(app.getHttpServer())
      .post('/decode')
      .send({ file: '/test.bin' });

    expect(res.status).toBe(200);
    expect(res.body.file).toBe('/test.bin');
    expect(res.body.parsers).toEqual([]);
  });

  it('should decode a binary file with a registered parser', async () => {
    await registry.register('/simple.ksy', SIMPLE_KSY);
    mockS3.get.mockResolvedValue('cafe0004deadbeefff');

    const res = await request(app.getHttpServer())
      .post('/decode')
      .send({ file: '/test.bin' });

    expect(res.status).toBe(200);
    expect(res.body.parsers).toHaveLength(1);
    expect(res.body.parsers[0].id).toBe('simple_packet');
    expect(res.body.parsers[0].success).toBe(true);
    expect(res.body.parsers[0].objectTree.children).toHaveLength(4);
    expect(res.body.parsers[0].objectTree.children[0].name).toBe('magic');
    expect(res.body.parsers[0].objectTree.children[0].value).toBe(0xcafe);
  });

  it('should include both successful and failed parse results', async () => {
    await registry.register('/simple.ksy', SIMPLE_KSY);
    // Only 2 bytes — not enough for the parser (needs magic + length + payload + checksum)
    mockS3.get.mockResolvedValue('cafe');

    const res = await request(app.getHttpServer())
      .post('/decode')
      .send({ file: '/short.bin' });

    expect(res.status).toBe(200);
    expect(res.body.parsers).toHaveLength(1);
    expect(res.body.parsers[0].success).toBe(false);
    expect(res.body.parsers[0].error).toBeDefined();
  });
});
