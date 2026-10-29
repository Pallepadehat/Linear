export { createS3Client, type StorageConfig } from './client'
export { extensionFor, objectKey, variantKey, type ObjectOwner } from './keys'
export {
  PRESIGNED_GET_TTL_SECONDS,
  PRESIGNED_PUT_TTL_SECONDS,
  createStorage,
  type ObjectHead,
  type Storage,
} from './storage'
