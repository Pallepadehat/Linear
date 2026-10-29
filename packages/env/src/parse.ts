import type { z } from 'zod'

export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined>,
  name: string,
): z.infer<T> {
  const result = schema.safeParse(source)
  if (!result.success) {
    // Only report variable names and messages — never values, which may be secrets.
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid ${name} environment:\n${issues.join('\n')}`)
  }
  return result.data
}
