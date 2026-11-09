import { labels, teams, type DbOrTx } from '@linear/db'
import { and, asc, eq, isNull, or } from 'drizzle-orm'
import { DomainError, isUniqueViolation } from '../errors'

const COLOR_PATTERN = /^#[0-9a-f]{6}$/

export type CreateLabelInput = {
  workspaceId: string
  /** Null or omitted = a workspace label shared by every team. */
  teamId?: string | null
  name: string
  color: string
}
export type UpdateLabelInput = { workspaceId: string; id: string; name?: string; color?: string }

function normalizeName(name: string) {
  const trimmed = name.trim()
  if (trimmed.length === 0) throw new DomainError('BAD_REQUEST', 'Label name is required')
  return trimmed
}

function normalizeColor(color: string) {
  const normalized = color.trim().toLowerCase()
  if (!COLOR_PATTERN.test(normalized)) {
    throw new DomainError('BAD_REQUEST', 'Label color must be a hex color like #5e6ad2')
  }
  return normalized
}

function duplicateName(error: unknown, name: string | undefined): never {
  if (
    isUniqueViolation(error, 'labels_workspace_id_name_unique') ||
    isUniqueViolation(error, 'labels_team_id_name_unique')
  ) {
    throw new DomainError('CONFLICT', `A label named "${name}" already exists`)
  }
  throw error
}

/**
 * Workspace labels plus the given team's labels; without a team, every label in
 * the workspace (each row carries its `teamId`). A team from elsewhere matches
 * no team labels.
 */
export async function listLabels(db: DbOrTx, workspaceId: string, teamId?: string) {
  return db
    .select()
    .from(labels)
    .where(
      and(
        eq(labels.workspaceId, workspaceId),
        teamId ? or(isNull(labels.teamId), eq(labels.teamId, teamId)) : undefined,
      ),
    )
    .orderBy(asc(labels.name), asc(labels.id))
}

async function assertTeam(db: DbOrTx, workspaceId: string, teamId: string) {
  const [team] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.workspaceId, workspaceId), eq(teams.id, teamId)))
  if (!team) throw new DomainError('NOT_FOUND', 'Team not found')
}

export async function createLabel(db: DbOrTx, input: CreateLabelInput) {
  const name = normalizeName(input.name)
  const color = normalizeColor(input.color)
  const teamId = input.teamId ?? null
  if (teamId) await assertTeam(db, input.workspaceId, teamId)
  try {
    // A savepoint keeps a duplicate-name failure from aborting an outer transaction.
    return await db.transaction(async (tx) => {
      const [label] = await tx
        .insert(labels)
        .values({ workspaceId: input.workspaceId, teamId, name, color })
        .returning()
      if (!label) throw new Error('label insert returned no row')
      return label
    })
  } catch (error) {
    duplicateName(error, name)
  }
}

export async function updateLabel(db: DbOrTx, input: UpdateLabelInput) {
  const changes = {
    name: input.name === undefined ? undefined : normalizeName(input.name),
    color: input.color === undefined ? undefined : normalizeColor(input.color),
  }
  try {
    return await db.transaction(async (tx) => {
      const [label] = await tx
        .update(labels)
        .set(changes)
        .where(and(eq(labels.workspaceId, input.workspaceId), eq(labels.id, input.id)))
        .returning()
      if (!label) throw new DomainError('NOT_FOUND', 'Label not found')
      return label
    })
  } catch (error) {
    duplicateName(error, changes.name)
  }
}

/** Removes the label from every issue too (issue_labels cascades). */
export async function deleteLabel(db: DbOrTx, workspaceId: string, id: string) {
  const [label] = await db
    .delete(labels)
    .where(and(eq(labels.workspaceId, workspaceId), eq(labels.id, id)))
    .returning({ id: labels.id })
  if (!label) throw new DomainError('NOT_FOUND', 'Label not found')
  return label
}
