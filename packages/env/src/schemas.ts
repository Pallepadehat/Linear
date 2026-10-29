import { z } from 'zod'

const nodeEnv = z.enum(['development', 'test', 'production']).default('development')
const logLevel = z
  .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  .default('info')

const s3 = {
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1).default('linear-uploads'),
}

// GitHub integration lands in M4; optional until then so the stack runs without an App.
const github = {
  GITHUB_APP_ID: z.string().min(1).optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
}

export const dbEnvSchema = z.object({
  DATABASE_URL: z.url(),
})

export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnv,
  LOG_LEVEL: logLevel,
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  APP_URL: z.url(),
  ...s3,
  ...github,
  GITHUB_WEBHOOK_SECRET: z.string().min(1).optional(),
})

export const workerEnvSchema = z.object({
  NODE_ENV: nodeEnv,
  LOG_LEVEL: logLevel,
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  ...s3,
  ...github,
})

export type ApiEnv = z.infer<typeof apiEnvSchema>
export type WorkerEnv = z.infer<typeof workerEnvSchema>
export type DbEnv = z.infer<typeof dbEnvSchema>
