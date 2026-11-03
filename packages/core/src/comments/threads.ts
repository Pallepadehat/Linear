import { DomainError } from '../errors'

/** The fields of a would-be parent that decide whether it can take a reply. */
export type ReplyParent = { issueId: string; parentId: string | null }

/**
 * Threads are one level deep: a reply's parent must be a root comment on the same
 * issue (docs/domain.md → Comments). A missing parent (or one in another
 * workspace) is NOT_FOUND so ids can't be probed.
 */
export function assertReplyParent(parent: ReplyParent | undefined, issueId: string) {
  if (!parent) throw new DomainError('NOT_FOUND', 'Comment not found')
  if (parent.parentId !== null) {
    throw new DomainError('BAD_REQUEST', "You can't reply to a reply")
  }
  if (parent.issueId !== issueId) {
    throw new DomainError('BAD_REQUEST', 'The reply must be on the same issue as its thread')
  }
}
