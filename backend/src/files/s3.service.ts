import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';

const BUCKET = 'kaitai-files';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3: S3Client;

  constructor() {
    this.s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
      this.logger.log(`Bucket "${BUCKET}" exists`);
    } catch {
      this.logger.log(`Creating bucket "${BUCKET}"...`);
      await this.s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    }
  }

  /** Store a file. Key is the full path (e.g. "/protocols/simple.ksy"). */
  async put(key: string, body: string | Buffer): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: normalizeKey(key),
        Body: typeof body === 'string' ? Buffer.from(body, 'utf-8') : body,
      }),
    );
  }

  /** Get file content as a string. Returns null if not found. */
  async get(key: string): Promise<string | null> {
    try {
      const res = await this.s3.send(
        new GetObjectCommand({
          Bucket: BUCKET,
          Key: normalizeKey(key),
        }),
      );
      return (await res.Body?.transformToString('utf-8')) ?? null;
    } catch (err: any) {
      if (err.name === 'NoSuchKey') return null;
      throw err;
    }
  }

  /** Delete a file. */
  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: normalizeKey(key),
      }),
    );
  }

  /** List all object keys, optionally filtered by prefix. */
  async list(prefix = ''): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const res = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: prefix ? normalizeKey(prefix) : undefined,
          ContinuationToken: continuationToken,
        }),
      );
      for (const obj of res.Contents ?? []) {
        if (obj.Key) keys.push('/' + obj.Key);
      }
      continuationToken = res.NextContinuationToken;
    } while (continuationToken);

    return keys;
  }
}

/** Strip leading slash for S3 key. */
function normalizeKey(key: string): string {
  return key.startsWith('/') ? key.slice(1) : key;
}
