import { z } from 'zod'
import { workspaceScopedSchema } from './common'

/** A project's health, set by its latest update (docs/domain.md → Project updates). */
export const projectHealthSchema = z.enum(['on_track', 'at_risk', 'off_track'])

export const projectUpdateBodySchema = z
  .string()
  .trim()
  .min(1, { message: 'Required' })
  .max(50_000, { message: 'Update is too long' })

export const projectUpdateAuthorSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  avatarUrl: z.url().nullable(),
})

export const projectUpdateSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  author: projectUpdateAuthorSchema,
  health: projectHealthSchema,
  /** Markdown. */
  body: z.string(),
  createdAt: z.date(),
  /** Differs from `createdAt` once the update was edited. */
  updatedAt: z.date(),
})

export const listProjectUpdatesInputSchema = workspaceScopedSchema.extend({
  projectId: z.uuid(),
  /** `nextCursor` from the previous page. */
  cursor: z.string().min(1).nullish(),
  limit: z.number().int().min(1).max(100).default(20),
})

export const projectUpdatesPageSchema = z.object({
  items: z.array(projectUpdateSchema),
  nextCursor: z.string().nullable(),
})

export const createProjectUpdateInputSchema = workspaceScopedSchema.extend({
  projectId: z.uuid(),
  health: projectHealthSchema,
  body: projectUpdateBodySchema,
})

export const updateProjectUpdateInputSchema = workspaceScopedSchema.extend({
  id: z.uuid(),
  health: projectHealthSchema.optional(),
  body: projectUpdateBodySchema.optional(),
})

export const projectUpdateIdInputSchema = workspaceScopedSchema.extend({ id: z.uuid() })

export type ProjectHealth = z.infer<typeof projectHealthSchema>
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>
export type ProjectUpdatesPage = z.infer<typeof projectUpdatesPageSchema>
export type ListProjectUpdatesInput = z.input<typeof listProjectUpdatesInputSchema>
export type CreateProjectUpdateInput = z.infer<typeof createProjectUpdateInputSchema>
export type UpdateProjectUpdateInput = z.infer<typeof updateProjectUpdateInputSchema>
