import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createS3Client, type StorageConfig } from './client'

export const PRESIGNED_PUT_TTL_SECONDS = 5 * 60
export const PRESIGNED_GET_TTL_SECONDS = 15 * 60

export type ObjectHead = { size: number; contentType: string | undefined }

export type Storage = {
  presignPut(key: string, contentType: string, size: number): Promise<string>
  presignGet(key: string): Promise<string>
  /** null when the object does not exist. */
  head(key: string): Promise<ObjectHead | null>
  get(key: string): Promise<Uint8Array>
  put(key: string, body: Uint8Array, contentType: string): Promise<void>
  delete(keys: string[]): Promise<void>
}

export function createStorage(
  config: StorageConfig,
  client: S3Client = createS3Client(config),
): Storage {
  const Bucket = config.bucket
  // Signing is offline, but the signature covers the host, so sign for the one the browser sees.
  const signer = config.publicEndpoint ? createS3Client(config, config.publicEndpoint) : client
  return {
    presignPut: (Key, ContentType, ContentLength) =>
      // Signing type and length makes the URL reject any other file.
      getSignedUrl(signer, new PutObjectCommand({ Bucket, Key, ContentType, ContentLength }), {
        expiresIn: PRESIGNED_PUT_TTL_SECONDS,
        signableHeaders: new Set(['content-type', 'content-length']),
      }),
    presignGet: (Key) =>
      getSignedUrl(signer, new GetObjectCommand({ Bucket, Key }), {
        expiresIn: PRESIGNED_GET_TTL_SECONDS,
      }),
    async head(Key) {
      try {
        const res = await client.send(new HeadObjectCommand({ Bucket, Key }))
        return { size: res.ContentLength ?? 0, contentType: res.ContentType }
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode
        if (status === 404) return null
        throw error
      }
    },
    async get(Key) {
      const res = await client.send(new GetObjectCommand({ Bucket, Key }))
      if (!res.Body) throw new Error(`object ${Key} has no body`)
      return res.Body.transformToByteArray()
    },
    async put(Key, Body, ContentType) {
      await client.send(new PutObjectCommand({ Bucket, Key, Body, ContentType }))
    },
    async delete(keys) {
      if (keys.length === 0) return
      await client.send(
        new DeleteObjectsCommand({
          Bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      )
    },
  }
}
