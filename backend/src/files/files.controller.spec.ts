import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { FilesController } from './files.controller';
import { S3Service } from './s3.service';

const mockS3 = {
  list: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

describe('FilesController (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        { provide: S3Service, useValue: mockS3 },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /files', () => {
    it('should return list of files', async () => {
      mockS3.list.mockResolvedValue(['/a.ksy', '/b.bin']);

      const res = await request(app.getHttpServer()).get('/files');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ files: ['/a.ksy', '/b.bin'] });
      expect(mockS3.list).toHaveBeenCalled();
    });
  });

  describe('GET /files/:path', () => {
    it('should return file content', async () => {
      mockS3.get.mockResolvedValue('file-content');

      const res = await request(app.getHttpServer()).get('/files/test.ksy');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ path: '/test.ksy', content: 'file-content' });
    });

    it('should return 404 for missing file', async () => {
      mockS3.get.mockResolvedValue(null);

      const res = await request(app.getHttpServer()).get('/files/missing.ksy');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /files/:path', () => {
    it('should create or overwrite a file', async () => {
      mockS3.put.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer())
        .put('/files/new.ksy')
        .send({ content: 'hello' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ path: '/new.ksy' });
      expect(mockS3.put).toHaveBeenCalledWith('/new.ksy', 'hello');
    });
  });

  describe('DELETE /files/:path', () => {
    it('should delete a file', async () => {
      mockS3.delete.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer()).delete('/files/old.ksy');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ deleted: '/old.ksy' });
      expect(mockS3.delete).toHaveBeenCalledWith('/old.ksy');
    });
  });
});
