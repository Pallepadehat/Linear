import type { MentionsResult } from '@linear/core'
import { publishChange } from '../realtime/publish'
import { notify } from './notify'

type Context = Parameters<typeof notify>[0] & Parameters<typeof publishChange>[0]

/**
 * After a write that added mentions has committed (docs/domain.md → Mentions): notify the
 * newly mentioned people and tell clients about their subscriptions and the backlinks.
 * `source` is the write's activity entry (descriptions) or comment.
 */
export async function announceMentions(
  context: Context,
  issueId: string,
  mentions: MentionsResult,
  source: { activityId: string } | { commentId: string } | null,
) {
  if (mentions.userIds.length > 0) {
    await publishChange(context, { type: 'issue.updated', issueId, fields: ['subscribers'] })
    if (source) {
      await notify(context, [{ issueId, event: 'mentioned', userIds: mentions.userIds, ...source }])
    }
  }
  // The mentioned issue's timeline shows the new `mentioned_in` entry.
  for (const target of mentions.mentionedIssueIds) {
    await publishChange(context, { type: 'issue.updated', issueId: target, fields: [] })
  }
}
