import { z } from 'zod'
import { workspaceScopedSchema } from './common'

/**
 * A web link's URL: absolute `http:` / `https:` only, so `javascript:`, `data:` or
 * `ftp:` links can never be rendered as clickable (docs/domain.md → Links).
 * Shared by issue links and, later, project links.
 */
export const linkUrlSchema = z
  .string()
  .trim()
  .max(2048, { message: 'URL is too long' })
  .pipe(z.url({ protocol: /^https?$/, message: 'Use a link that starts with https://' }))

/** Optional display title; empty means "use the hostname". */
export const linkTitleSchema = z.string().trim().max(255, { message: 'Title is too long' })

/** The add / edit link form (app) and the shared part of the create / update inputs. */
export const linkFieldsSchema = z.object({
  url: linkUrlSchema,
  title: linkTitleSchema.optional(),
})

export const issueLinkSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  title: z.string(),
  /** `new URL(url).hostname` without a leading `www.`. */
  hostname: z.string(),
  createdAt: z.date(),
})

export const createIssueLinkInputSchema = workspaceScopedSchema
  .extend({ issueId: z.uuid() })
  .extend(linkFieldsSchema.shape)

/** Omitted fields are left unchanged; an empty `title` resets it to the hostname. */
export const updateIssueLinkInputSchema = workspaceScopedSchema.extend({
  id: z.uuid(),
  url: linkUrlSchema.optional(),
  title: linkTitleSchema.optional(),
})

export const issueLinkIdInputSchema = workspaceScopedSchema.extend({ id: z.uuid() })

export type LinkFields = z.input<typeof linkFieldsSchema>
export type IssueLink = z.infer<typeof issueLinkSchema>
export type CreateIssueLinkInput = z.input<typeof createIssueLinkInputSchema>
export type UpdateIssueLinkInput = z.input<typeof updateIssueLinkInputSchema>

/** A project resource link; the same fields as an issue link. */
export const projectLinkSchema = issueLinkSchema.extend({ projectId: z.uuid() })

export const listProjectLinksInputSchema = workspaceScopedSchema.extend({ projectId: z.uuid() })

export const createProjectLinkInputSchema = workspaceScopedSchema
  .extend({ projectId: z.uuid() })
  .extend(linkFieldsSchema.shape)

export const updateProjectLinkInputSchema = updateIssueLinkInputSchema
export const projectLinkIdInputSchema = issueLinkIdInputSchema

export type ProjectLink = z.infer<typeof projectLinkSchema>
export type CreateProjectLinkInput = z.input<typeof createProjectLinkInputSchema>
export type UpdateProjectLinkInput = z.input<typeof updateProjectLinkInputSchema>
