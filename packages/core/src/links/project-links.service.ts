import { projectLinks, projects, type DbOrTx } from '@linear/db'
import { and, asc, eq, max } from 'drizzle-orm'
import { DomainError } from '../errors'
import { linkHostname, nextLinkTitle, parseWebUrl, resolveLinkTitle } from './link-url'

export type ProjectLinkRecord = typeof projectLinks.$inferSelect & { hostname: string }

const withHostname = (row: typeof projectLinks.$inferSelect): ProjectLinkRecord => ({
  ...row,
  hostname: linkHostname(row.url),
})

const inWorkspace = (workspaceId: string) => eq(projectLinks.workspaceId, workspaceId)

/** Locks the project row (so concurrent creates get distinct positions) or `NOT_FOUND`. */
async function lockProject(db: DbOrTx, workspaceId: string, projectId: string) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)))
    .for('update')
  if (!project) throw new DomainError('NOT_FOUND', 'Project not found')
}

/** Adds a resource link at the end of the project's list. */
export async function createProjectLink(
  db: DbOrTx,
  input: { workspaceId: string; projectId: string; url: string; title?: string; actorId: string },
) {
  parseWebUrl(input.url)
  return db.transaction(async (tx) => {
    await lockProject(tx, input.workspaceId, input.projectId)
    const [last] = await tx
      .select({ sortOrder: max(projectLinks.sortOrder) })
      .from(projectLinks)
      .where(and(inWorkspace(input.workspaceId), eq(projectLinks.projectId, input.projectId)))
    const [link] = await tx
      .insert(projectLinks)
      .values({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        url: input.url,
        title: resolveLinkTitle(input.url, input.title),
        sortOrder: (last?.sortOrder ?? -1) + 1,
        createdById: input.actorId,
      })
      .returning()
    if (!link) throw new Error('project link insert returned no row')
    return withHostname(link)
  })
}

/** Changes a link's URL and/or title, with the same title rules as issue links. */
export async function updateProjectLink(
  db: DbOrTx,
  input: { workspaceId: string; id: string; url?: string; title?: string },
) {
  if (input.url !== undefined) parseWebUrl(input.url)
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(projectLinks)
      .where(and(inWorkspace(input.workspaceId), eq(projectLinks.id, input.id)))
      .for('update')
    if (!current) throw new DomainError('NOT_FOUND', 'Link not found')
    const url = input.url ?? current.url
    const [link] = await tx
      .update(projectLinks)
      .set({ url, title: nextLinkTitle(current, url, input.title), updatedAt: new Date() })
      .where(eq(projectLinks.id, current.id))
      .returning()
    if (!link) throw new Error('project link update returned no row')
    return withHostname(link)
  })
}

export async function deleteProjectLink(db: DbOrTx, input: { workspaceId: string; id: string }) {
  const [link] = await db
    .delete(projectLinks)
    .where(and(inWorkspace(input.workspaceId), eq(projectLinks.id, input.id)))
    .returning()
  if (!link) throw new DomainError('NOT_FOUND', 'Link not found')
  return link
}

/** The project's resource links in their order; a project of another workspace is `NOT_FOUND`. */
export async function listProjectLinks(db: DbOrTx, workspaceId: string, projectId: string) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)))
  if (!project) throw new DomainError('NOT_FOUND', 'Project not found')
  const rows = await db
    .select()
    .from(projectLinks)
    .where(and(inWorkspace(workspaceId), eq(projectLinks.projectId, projectId)))
    .orderBy(asc(projectLinks.sortOrder), asc(projectLinks.id))
  return rows.map(withHostname)
}
