import type { ObjectHead, Storage } from './storage'

/** In-memory S3 stand-in for tests; "upload" by writing to `objects`. */
export function createMemoryStorage() {
  const objects = new Map<string, { body: Uint8Array; contentType: string }>()
  const storage: Storage = {
    presignPut: async (key) => `http://storage.test/put/${key}`,
    presignGet: async (key) => `http://storage.test/get/${key}`,
    head: async (key): Promise<ObjectHead | null> => {
      const object = objects.get(key)
      return object ? { size: object.body.byteLength, contentType: object.contentType } : null
    },
    get: async (key) => {
      const object = objects.get(key)
      if (!object) throw new Error(`no object ${key}`)
      return object.body
    },
    put: async (key, body, contentType) => {
      objects.set(key, { body, contentType })
    },
    delete: async (keys) => {
      for (const key of keys) objects.delete(key)
    },
  }
  return { storage, objects }
}
