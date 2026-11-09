import { S3Client } from '@aws-sdk/client-s3'

export type StorageConfig = {
  endpoint: string
  /**
   * Host the browser uses for presigned URLs, when it differs from `endpoint`
   * (e.g. the API reaches storage at `http://storage:9000` inside Docker).
   */
  publicEndpoint?: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

export function createS3Client(config: StorageConfig, endpoint = config.endpoint) {
  return new S3Client({
    endpoint,
    region: config.region,
    // MinIO/RustFS serve buckets by path (`host/bucket/key`), not virtual hosts.
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  })
}
