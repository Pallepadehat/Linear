import { z } from 'zod'
import { activityActorTypeSchema } from './activity'
import { issuePrioritySchema } from './issues'
import { projectDateSchema, projectStatusSchema } from './projects'
import { workspaceScopedSchema } from './common'

/** Who wrote a project event; null for GitHub automation or a deleted user. */
export const projectActivityActorSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  avatarUrl: z.url().nullable(),
})

const issueRefSchema = z.object({
  issueId: z.uuid(),
  /** As it was when the event was written (`TIP-12`), so removed issues still read. */
  identifier: z.string(),
  title: z.string(),
})
const milestoneRefSchema = z.object({ milestoneId: z.uuid(), name: z.string() })

const base = {
  id: z.uuid(),
  projectId: z.uuid(),
  actorType: activityActorTypeSchema,
  actor: projectActivityActorSchema.nullable(),
  createdAt: z.date(),
}

/**
 * One project event (docs/domain.md → Project activity). Payloads carry ids plus the
 * from/to values needed to render it; names of leads are resolved by the client.
 */
export const projectActivitySchema = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('project.created'), payload: z.object({}) }),
  z.object({
    ...base,
    kind: z.literal('project.status_changed'),
    payload: z.object({ from: projectStatusSchema, to: projectStatusSchema }),
  }),
  z.object({
    ...base,
    kind: z.literal('project.priority_changed'),
    payload: z.object({ from: issuePrioritySchema, to: issuePrioritySchema }),
  }),
  z.object({
    ...base,
    kind: z.literal('project.lead_changed'),
    payload: z.object({ from: z.uuid().nullable(), to: z.uuid().nullable() }),
  }),
  z.object({
    ...base,
    kind: z.literal('project.dates_changed'),
    payload: z.object({
      field: z.enum(['startDate', 'targetDate']),
      from: projectDateSchema.nullable(),
      to: projectDateSchema.nullable(),
    }),
  }),
  z.object({ ...base, kind: z.literal('milestone.created'), payload: milestoneRefSchema }),
  z.object({ ...base, kind: z.literal('milestone.completed'), payload: milestoneRefSchema }),
  z.object({
    ...base,
    kind: z.literal('project_update.posted'),
    payload: z.object({ updateId: z.uuid() }),
  }),
  z.object({ ...base, kind: z.literal('project.issue_added'), payload: issueRefSchema }),
  z.object({ ...base, kind: z.literal('project.issue_removed'), payload: issueRefSchema }),
])

export const listProjectActivityInputSchema = workspaceScopedSchema.extend({
  projectId: z.uuid(),
  /** `nextCursor` from the previous page. */
  cursor: z.string().min(1).nullish(),
  limit: z.number().int().min(1).max(100).default(50),
})

export const projectActivityPageSchema = z.object({
  items: z.array(projectActivitySchema),
  nextCursor: z.string().nullable(),
})

export type ProjectActivity = z.infer<typeof projectActivitySchema>
export type ProjectActivityKind = ProjectActivity['kind']
export type ProjectActivityPage = z.infer<typeof projectActivityPageSchema>
export type ListProjectActivityInput = z.input<typeof listProjectActivityInputSchema>
