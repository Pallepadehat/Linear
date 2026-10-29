import { z } from 'zod'
import { nameSchema } from './common'

export const userSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  avatarUrl: z.url().nullable(),
})

export const updateMeInputSchema = z.object({
  name: nameSchema.optional(),
  /** A confirmed `avatar` upload, or null to remove the avatar. */
  avatarUploadId: z.uuid().nullable().optional(),
})

export type User = z.infer<typeof userSchema>
export type UpdateMeInput = z.infer<typeof updateMeInputSchema>
