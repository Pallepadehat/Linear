import { z } from 'zod'
import { workspaceScopedSchema } from './common'
import { workflowStatusSchema } from './teams'

/**
 * Directed: `blocks` = issueId blocks relatedIssueId, `duplicate` = issueId is a
 * duplicate of relatedIssueId; `related` has no direction (docs/domain.md → Relations).
 */
export const issueRelationTypeSchema = z.enum(['blocks', 'related', 'duplicate'])

export const issueRelationSchema = z.object({
  id: z.uuid(),
  issueId: z.uuid(),
  relatedIssueId: z.uuid(),
  type: issueRelationTypeSchema,
})

/** The other issue of a relation, as seen from one side. */
export const relatedIssueSchema = z.object({
  relationId: z.uuid(),
  id: z.uuid(),
  identifier: z.string(),
  title: z.string(),
  status: workflowStatusSchema,
})

/** Every relation of an issue, read from its side (both directions are listed). */
export const issueRelationsSchema = z.object({
  blocks: z.array(relatedIssueSchema),
  blockedBy: z.array(relatedIssueSchema),
  related: z.array(relatedIssueSchema),
  duplicateOf: z.array(relatedIssueSchema),
  duplicates: z.array(relatedIssueSchema),
})

export const createIssueRelationInputSchema = workspaceScopedSchema
  .extend({
    issueId: z.uuid(),
    relatedIssueId: z.uuid(),
    type: issueRelationTypeSchema,
  })
  .refine((input) => input.issueId !== input.relatedIssueId, {
    message: 'An issue cannot be related to itself',
    path: ['relatedIssueId'],
  })

export const issueRelationIdInputSchema = workspaceScopedSchema.extend({ id: z.uuid() })

export type IssueRelationType = z.infer<typeof issueRelationTypeSchema>
export type IssueRelation = z.infer<typeof issueRelationSchema>
export type RelatedIssue = z.infer<typeof relatedIssueSchema>
export type IssueRelations = z.infer<typeof issueRelationsSchema>
export type CreateIssueRelationInput = z.input<typeof createIssueRelationInputSchema>
