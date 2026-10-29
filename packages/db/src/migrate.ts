import { loadDbEnv } from '@linear/env'
import { migrateDatabase } from './migrator'

const env = loadDbEnv()
await migrateDatabase(env.DATABASE_URL)
console.log('migrations applied')
