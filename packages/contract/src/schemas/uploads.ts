import { z } from 'zod'
import { workspaceSlugSchema } from './common'

const MB = 1024 * 1024

/**
 * Accepted types and sizes per kind (docs/domain.md → Uploads). SVG icons are
 * not accepted until server-side sanitization exists; attachments are P1.
 */
export const UPLOAD_RULES = {
  avatar: { contentTypes: ['image/png', 'image/jpeg', 'image/webp'], maxBytes: 2 * MB },
  workspace_icon: { contentTypes: ['image/png', 'image/jpeg', 'image/webp'], maxBytes: 1 * MB },
  project_icon: { contentTypes: ['image/png', 'image/jpeg', 'image/webp'], maxBytes: 1 * MB },
} as const

export const uploadKindSchema = z.enum(['avatar', 'workspace_icon', 'project_icon'])
export type UploadKind = z.infer<typeof uploadKindSchema>

export const createPresignedUploadInputSchema = z
  .object({
    kind: uploadKindSchema,
    contentType: z.string(),
    size: z.number().int().positive(),
    /** Required for workspace-owned kinds; must be absent for avatars. */
    workspaceSlug: workspaceSlugSchema.optional(),
  })
  .superRefine((input, ctx) => {
    const rule = UPLOAD_RULES[input.kind]
    if (!(rule.contentTypes as readonly string[]).includes(input.contentType)) {
      ctx.addIssue({ code: 'custom', path: ['contentType'], message: 'Unsupported file type' })
    }
    if (input.size > rule.maxBytes) {
      ctx.addIssue({
        code: 'custom',
        path: ['size'],
        message: `File is larger than ${rule.maxBytes / MB} MB`,
      })
    }
    if ((input.kind === 'avatar') !== (input.workspaceSlug === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['workspaceSlug'],
        message:
          input.kind === 'avatar' ? 'Avatars are not workspace-owned' : 'Workspace is required',
      })
    }
  })

export const createPresignedUploadOutputSchema = z.object({
  uploadId: z.uuid(),
  url: z.url(),
  method: z.literal('PUT'),
  /** Headers the browser must send with the PUT; they are part of the signature. */
  headers: z.record(z.string(), z.string()),
  expiresAt: z.date(),
})

export const uploadIdInputSchema = z.object({ uploadId: z.uuid() })

export const uploadSchema = z.object({
  id: z.uuid(),
  kind: uploadKindSchema,
  status: z.enum(['pending', 'ready', 'deleted']),
})

export const uploadUrlSchema = z.object({ url: z.url(), expiresAt: z.date() })

export type CreatePresignedUploadInput = z.infer<typeof createPresignedUploadInputSchema>
export type CreatePresignedUploadOutput = z.infer<typeof createPresignedUploadOutputSchema>
