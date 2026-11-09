import { issueLinks, type DbOrTx } from '@linear/db'
import { and, asc, eq } from 'drizzle-orm'
import { recordActivity } from '../activity/activity.service'
import { DomainError } from '../errors'
import { issueExistsInWorkspace } from '../issues/issues.service'
import { linkHostname, nextLinkTitle, parseWebUrl, resolveLinkTitle } from './link-url'

export type IssueLinkRecord = typeof issueLinks.$inferSelect & { hostname: string }

const withHostname = (row: typeof issueLinks.$inferSelect): IssueLinkRecord => ({
  ...row,
  hostname: linkHostname(row.url),
})

/** Attaches a web link to an issue of the workspace and records "added link". */
export async function createIssueLink(
  db: DbOrTx,
  input: { workspaceId: string; issueId: string; url: string; title?: string; actorId: string },
) {
  parseWebUrl(input.url)
  return db.transaction(async (tx) => {
    if (!(await issueExistsInWorkspace(tx, input.workspaceId, input.issueId))) {
      throw new DomainError('NOT_FOUND', 'Issue not found')
    }
    const [link] = await tx
      .insert(issueLinks)
      .values({
        workspaceId: input.workspaceId,
        issueId: input.issueId,
        url: input.url,
        title: resolveLinkTitle(input.url, input.title),
        createdById: input.actorId,
      })
      .returning()
    if (!link) throw new Error('link insert returned no row')
    await recordActivity(tx, {
      workspaceId: input.workspaceId,
      issueId: link.issueId,
      actor: { type: 'user', id: input.actorId },
      changes: [{ kind: 'link', from: null, to: [link.title, link.url] }],
    })
    return withHostname(link)
  })
}

/**
 * Changes a link's URL and/or title. An empty title (or a new URL while the title
 * was the old hostname) resolves to the hostname again.
 */
export async function updateIssueLink(
  db: DbOrTx,
  input: { workspaceId: string; id: string; url?: string; title?: string },
) {
  if (input.url !== undefined) parseWebUrl(input.url)
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(issueLinks)
      .where(and(eq(issueLinks.workspaceId, input.workspaceId), eq(issueLinks.id, input.id)))
      .for('update')
    if (!current) throw new DomainError('NOT_FOUND', 'Link not found')
    const url = input.url ?? current.url
    const title = nextLinkTitle(current, url, input.title)
    const [link] = await tx
      .update(issueLinks)
      .set({ url, title })
      .where(eq(issueLinks.id, current.id))
      .returning()
    if (!link) throw new Error('link update returned no row')
    return withHostname(link)
  })
}

/** Removes a link and records "removed link". */
export async function deleteIssueLink(
  db: DbOrTx,
  input: { workspaceId: string; id: string; actorId: string },
) {
  return db.transaction(async (tx) => {
    const [link] = await tx
      .delete(issueLinks)
      .where(and(eq(issueLinks.workspaceId, input.workspaceId), eq(issueLinks.id, input.id)))
      .returning()
    if (!link) throw new DomainError('NOT_FOUND', 'Link not found')
    await recordActivity(tx, {
      workspaceId: input.workspaceId,
      issueId: link.issueId,
      actor: { type: 'user', id: input.actorId },
      changes: [{ kind: 'link', from: [link.title, link.url], to: null }],
    })
    return link
  })
}

/** The issue's web links, oldest first. */
export async function listIssueLinks(db: DbOrTx, workspaceId: string, issueId: string) {
  const rows = await db
    .select()
    .from(issueLinks)
    .where(and(eq(issueLinks.workspaceId, workspaceId), eq(issueLinks.issueId, issueId)))
    .orderBy(asc(issueLinks.id))
  return rows.map(withHostname)
}
