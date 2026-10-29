import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { toTypedSchema } from './form-schema'

const schema = toTypedSchema(
  z.object({ email: z.email({ message: 'Bad email' }), name: z.string().trim().min(1) }),
)

describe('toTypedSchema', () => {
  it('returns parsed output when valid', async () => {
    expect(await schema.parse({ email: 'a@b.co', name: ' Ada ' })).toEqual({
      value: { email: 'a@b.co', name: 'Ada' },
      errors: [],
    })
  })

  it('groups messages by field path', async () => {
    const { errors } = await schema.parse({ email: 'nope', name: '' })
    expect(errors).toContainEqual({ path: 'email', errors: ['Bad email'] })
    expect(errors.map((e) => e.path)).toContain('name')
  })
})
