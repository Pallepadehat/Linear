import { loadRootEnvFile } from './load-env-file'
import { parseEnv } from './parse'
import { apiEnvSchema, dbEnvSchema, workerEnvSchema } from './schemas'

export { loadRootEnvFile } from './load-env-file'
export { parseEnv } from './parse'
export * from './schemas'

export function loadApiEnv(source = defaultSource()) {
  return parseEnv(apiEnvSchema, source, 'api')
}

export function loadWorkerEnv(source = defaultSource()) {
  return parseEnv(workerEnvSchema, source, 'worker')
}

export function loadDbEnv(source = defaultSource()) {
  return parseEnv(dbEnvSchema, source, 'db')
}

function defaultSource() {
  loadRootEnvFile()
  return process.env
}
