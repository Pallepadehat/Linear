import type { z } from 'zod'

export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined>,
  name: string,
): z.infer<T> {
  // `KEY=` in .env means "not set" (e.g. the blank GitHub App keys in .env.example).
  const defined = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''))
  const result = schema.safeParse(defined)
  if (!result.success) {
    // Only report variable names and messages — never values, which may be secrets.
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid ${name} environment:\n${issues.join('\n')}`)
  }
  return result.data
}
