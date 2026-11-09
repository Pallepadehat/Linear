import type { issueRelationType } from '@linear/db'

export type IssueRelationType = (typeof issueRelationType.enumValues)[number]

/** How a relation reads from one of its issues (stored in the activity log). */
export type RelationRole = 'blocks' | 'blocked_by' | 'related' | 'duplicate_of' | 'duplicated_by'

/** The role of the relation's `issueId` side and of its `relatedIssueId` side. */
export function relationRoles(type: IssueRelationType): {
  source: RelationRole
  target: RelationRole
} {
  switch (type) {
    case 'blocks':
      return { source: 'blocks', target: 'blocked_by' }
    case 'duplicate':
      return { source: 'duplicate_of', target: 'duplicated_by' }
    case 'related':
      return { source: 'related', target: 'related' }
  }
}

/** Categories whose issues no longer block anything, nor count as blocked. */
export const CLOSED_STATUS_CATEGORIES = ['completed', 'canceled'] as const
