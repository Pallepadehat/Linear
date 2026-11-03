import type { IssueRelationType } from '@linear/contract'

/** The "Mark as" choices, as seen from the issue being edited. */
export type RelationKind = 'blockedBy' | 'blocking' | 'related' | 'duplicateOf'

export const RELATION_KINDS: { kind: RelationKind; label: string; title: string }[] = [
  { kind: 'blockedBy', label: 'Blocked by…', title: 'Blocked by' },
  { kind: 'blocking', label: 'Blocking…', title: 'Blocking' },
  { kind: 'related', label: 'Related to…', title: 'Related to' },
  { kind: 'duplicateOf', label: 'Duplicate of…', title: 'Duplicate of' },
]

/** The stored relation: `blocks` runs from blocker to blocked, `duplicate` from the duplicate. */
export function relationFor(
  kind: RelationKind,
  self: string,
  other: string,
): { issueId: string; relatedIssueId: string; type: IssueRelationType } {
  switch (kind) {
    case 'blockedBy':
      return { issueId: other, relatedIssueId: self, type: 'blocks' }
    case 'blocking':
      return { issueId: self, relatedIssueId: other, type: 'blocks' }
    case 'related':
      return { issueId: self, relatedIssueId: other, type: 'related' }
    case 'duplicateOf':
      return { issueId: self, relatedIssueId: other, type: 'duplicate' }
  }
}
