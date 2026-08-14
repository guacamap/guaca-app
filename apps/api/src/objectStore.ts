import {
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

/**
 * Photo bytes seam (§8): S3 protocol, MinIO locally, R2/S3 later by env.
 * Injectable so tests run against an in-memory map instead of a service.
 */
export interface ObjectStore {
  put(key: string, bytes: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}

export function createObjectStore(env: NodeJS.ProcessEnv = process.env): ObjectStore {
  const bucket = env.S3_BUCKET ?? 'guaca-photos';
  const client = new S3Client({
    endpoint: env.S3_ENDPOINT ?? 'http://localhost:9000',
    region: env.S3_REGION ?? 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY ?? 'minioadmin',
      secretAccessKey: env.S3_SECRET_KEY ?? 'minioadmin',
    },
  });

  let bucketReady = false;
  const ensureBucket = async () => {
    if (bucketReady) return;
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch (err) {
      const name = (err as { name?: string }).name ?? '';
      if (name !== 'BucketAlreadyOwnedByYou' && name !== 'BucketAlreadyExists') throw err;
    }
    bucketReady = true;
  };

  return {
    async put(key, bytes, mimeType) {
      await ensureBucket();
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: mimeType }),
      );
    },
    async get(key) {
      await ensureBucket();
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const bytes = await res.Body?.transformToByteArray();
        return bytes ? Buffer.from(bytes) : null;
      } catch {
        return null;
      }
    },
  };
}

/** Test double — same seam, no network. */
export function memoryObjectStore(): ObjectStore & { size(): number } {
  const items = new Map<string, Buffer>();
  return {
    async put(key, bytes) {
      items.set(key, bytes);
    },
    async get(key) {
      return items.get(key) ?? null;
    },
    size: () => items.size,
  };
}
