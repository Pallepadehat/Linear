import { loadRootEnvFile } from '@linear/env'
import { prepareTestDatabase, testDatabaseUrl } from '@linear/db/testing'

export default async function setup() {
  loadRootEnvFile()
  await prepareTestDatabase(testDatabaseUrl())
}
