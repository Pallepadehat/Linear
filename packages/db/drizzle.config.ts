import { loadDbEnv } from '@linear/env'
import { defineConfig } from 'drizzle-kit'

const env = loadDbEnv()

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url: env.DATABASE_URL },
  strict: true,
})
