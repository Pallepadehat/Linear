import { issues, teams, workspaceMembers, type DbOrTx } from '@linear/db'
import { and, eq, inArray, or } from 'drizzle-orm'
import { recordActivity } from '../activity/activity.service'
import { subscribeUsers } from '../subscriptions/subscriptions.service'
import { addedMentions } from './parse'

export type SyncMentionsInput = {
  workspaceId: string
  /** The issue the text belongs to (its description, or one of its comments). */
  issueId: string
  actorId: string
  /** The text before the write; null on create. */
  before: string | null
  after: string | null
  /** Set when the text is a comment. */
  commentId?: string
}

export type MentionsResult = {
  /** Newly mentioned members (never the actor): subscribed now, to be notified after commit. */
  userIds: string[]
  /** Issues newly mentioned, each with a new `mentioned_in` entry. */
  mentionedIssueIds: string[]
}

/**
 * Applies the mentions a write adds (docs/domain.md → Mentions), inside its transaction:
 * subscribes newly mentioned members and writes a `mentioned_in` backlink on each newly
 * mentioned issue. Unknown users and identifiers, and anything outside the workspace,
 * are dropped silently. Mentions that were already there do nothing again.
 */
export async function syncMentions(tx: DbOrTx, input: SyncMentionsInput): Promise<MentionsResult> {
  const added = addedMentions(input.before, input.after)
  const candidates = added.userIds.filter((id) => id !== input.actorId)

  const userIds =
    candidates.length === 0
      ? []
      : (
          await tx
            .select({ userId: workspaceMembers.userId })
            .from(workspaceMembers)
            .where(
              and(
                eq(workspaceMembers.workspaceId, input.workspaceId),
                inArray(workspaceMembers.userId, candidates),
              ),
            )
        )
          .map((r) => r.userId)
          // Keep the order they were written in.
          .sort((a, b) => candidates.indexOf(a) - candidates.indexOf(b))
  await subscribeUsers(tx, input.issueId, userIds)

  const mentionedIssueIds = await backlink(tx, input, added.issueIdentifiers)
  return { userIds, mentionedIssueIds }
}

async function backlink(tx: DbOrTx, input: SyncMentionsInput, identifiers: string[]) {
  if (identifiers.length === 0) return []
  const refs = identifiers.map((identifier) => {
    const at = identifier.lastIndexOf('-')
    return { key: identifier.slice(0, at), number: Number(identifier.slice(at + 1)) }
  })
  const targets = await tx
    .select({ id: issues.id })
    .from(issues)
    .innerJoin(teams, eq(teams.id, issues.teamId))
    .where(
      and(
        eq(issues.workspaceId, input.workspaceId),
        or(...refs.map((r) => and(eq(teams.key, r.key), eq(issues.number, r.number)))),
      ),
    )
  // An issue mentioning itself isn't a backlink.
  const targetIds = targets.map((t) => t.id).filter((id) => id !== input.issueId)
  if (targetIds.length === 0) return []

  const [source] = await tx
    .select({ key: teams.key, number: issues.number })
    .from(issues)
    .innerJoin(teams, eq(teams.id, issues.teamId))
    .where(and(eq(issues.workspaceId, input.workspaceId), eq(issues.id, input.issueId)))
  if (!source) return []
  const to = [input.issueId, `${source.key}-${source.number}`]
  if (input.commentId) to.push(input.commentId)
  for (const issueId of targetIds) {
    await recordActivity(tx, {
      workspaceId: input.workspaceId,
      issueId,
      actor: { type: 'user', id: input.actorId },
      changes: [{ kind: 'mentioned_in', from: null, to }],
    })
  }
  return targetIds
}
