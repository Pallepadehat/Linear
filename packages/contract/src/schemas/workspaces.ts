import { z } from 'zod'
import { nameSchema, teamKeySchema, workspaceScopedSchema, workspaceSlugSchema } from './common'
import { teamSchema } from './teams'

export const workspaceRoleSchema = z.enum(['owner', 'member'])

export const workspaceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  role: workspaceRoleSchema,
})

export const createWorkspaceInputSchema = z.object({
  name: nameSchema,
  slug: workspaceSlugSchema,
  team: z.object({ name: nameSchema, key: teamKeySchema }).optional(),
})

export const createWorkspaceOutputSchema = z.object({
  workspace: workspaceSchema,
  team: teamSchema.nullable(),
})

export const memberSchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  email: z.email(),
  avatarUrl: z.url().nullable(),
  role: workspaceRoleSchema,
  joinedAt: z.date(),
})

export const getWorkspaceInputSchema = workspaceScopedSchema

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>
export type Workspace = z.infer<typeof workspaceSchema>
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>
export type Member = z.infer<typeof memberSchema>
