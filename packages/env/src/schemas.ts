import { z } from 'zod'

const nodeEnv = z.enum(['development', 'test', 'production']).default('development')
const logLevel = z
  .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  .default('info')

const s3 = {
  S3_ENDPOINT: z.url(),
  // Browser-facing storage URL for presigned links; defaults to S3_ENDPOINT.
  S3_PUBLIC_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1).default('linear-uploads'),
}

// Optional so the stack runs without a GitHub App; the integration is off until all are set.
const github = {
  GITHUB_APP_ID: z.string().min(1).optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
}

export const dbEnvSchema = z.object({
  DATABASE_URL: z.url(),
})

const GITHUB_APP_KEYS = [
  'GITHUB_APP_ID',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_APP_SLUG',
  'GITHUB_APP_CLIENT_ID',
  'GITHUB_APP_CLIENT_SECRET',
] as const

export const apiEnvSchema = z
  .object({
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
    GITHUB_APP_SLUG: z.string().min(1).optional(),
    GITHUB_APP_CLIENT_ID: z.string().min(1).optional(),
    GITHUB_APP_CLIENT_SECRET: z.string().min(1).optional(),
    GITHUB_WEBHOOK_SECRET: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    // A half-configured App would fail at install time; fail at startup instead.
    const missing = GITHUB_APP_KEYS.filter((key) => !env[key])
    if (missing.length > 0 && missing.length < GITHUB_APP_KEYS.length) {
      for (const key of missing) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'Required when any GITHUB_APP_* is set',
        })
      }
    }
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
