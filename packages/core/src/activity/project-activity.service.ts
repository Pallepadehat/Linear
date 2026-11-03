import {
  projectActivity,
  projects,
  users,
  type DbOrTx,
  type ProjectActivityEvent,
} from '@linear/db'
import { and, desc, eq, lt } from 'drizzle-orm'
import { assertCursor } from '../cursor'
import { DomainError } from '../errors'
import type { ActivityActor } from './activity.service'

/** Call inside the transaction that made the change, so both commit or neither does. */
export async function recordProjectActivity(
  tx: DbOrTx,
  input: {
    workspaceId: string
    projectId: string
    actor: ActivityActor
    events: ProjectActivityEvent[]
  },
) {
  if (input.events.length === 0) return
  const actorId = input.actor.type === 'user' ? input.actor.id : null
  await tx.insert(projectActivity).values(
    input.events.map((event) => ({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      actorType: input.actor.type,
      actorId,
      kind: event.kind,
      payload: event.payload,
    })),
  )
}

export type ListProjectActivityInput = {
  workspaceId: string
  projectId: string
  cursor?: string | null
  limit: number
}

const columns = {
  id: projectActivity.id,
  projectId: projectActivity.projectId,
  actorType: projectActivity.actorType,
  actorId: projectActivity.actorId,
  actorName: users.name,
  actorAvatarUploadId: users.avatarUploadId,
  kind: projectActivity.kind,
  payload: projectActivity.payload,
  createdAt: projectActivity.createdAt,
}

/**
 * Newest first, paged by id (UUIDv7, so time-ordered): the cursor is the last id of
 * the previous page and the next page holds the older entries.
 */
export async function listProjectActivity(db: DbOrTx, input: ListProjectActivityInput) {
  assertCursor(input.cursor)
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.workspaceId, input.workspaceId), eq(projects.id, input.projectId)))
  if (!project) throw new DomainError('NOT_FOUND', 'Project not found')

  const rows = await db
    .select(columns)
    .from(projectActivity)
    .leftJoin(users, eq(users.id, projectActivity.actorId))
    .where(
      and(
        eq(projectActivity.workspaceId, input.workspaceId),
        eq(projectActivity.projectId, project.id),
        input.cursor ? lt(projectActivity.id, input.cursor) : undefined,
      ),
    )
    .orderBy(desc(projectActivity.id))
    .limit(input.limit + 1)
  const items = rows.slice(0, input.limit)
  const nextCursor = rows.length > input.limit ? (items.at(-1)?.id ?? null) : null
  return { items, nextCursor }
}

export type ProjectActivityRecord = Awaited<ReturnType<typeof listProjectActivity>>['items'][number]
