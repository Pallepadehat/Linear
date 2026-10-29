// Self-contained (no relative imports): it is loaded by apps/app/vite.config.ts,
// which Node runs with native type stripping and therefore no extensionless resolution.
import { z } from 'zod'

/**
 * Browser env. Only `VITE_*` variables are allowed here; it is validated in
 * `apps/app/vite.config.ts` (build time), never imported by browser code.
 */
export const appEnvSchema = z.object({
  // Empty in dev: the Vite proxy makes the API same-origin.
  VITE_API_URL: z.union([z.literal(''), z.url()]).default(''),
})

export type AppEnv = z.infer<typeof appEnvSchema>

export function loadAppEnv(source: Record<string, string | undefined>): AppEnv {
  const result = appEnvSchema.safeParse(source)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid app environment:\n${issues.join('\n')}`)
  }
  return result.data
}
