import { S3Client } from '@aws-sdk/client-s3'

export type StorageConfig = {
  endpoint: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

export function createS3Client(config: StorageConfig) {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    // MinIO/RustFS serve buckets by path (`host/bucket/key`), not virtual hosts.
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  })
}
