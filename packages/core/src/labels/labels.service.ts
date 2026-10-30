import { labels, type DbOrTx } from '@linear/db'
import { and, asc, eq } from 'drizzle-orm'
import { DomainError, isUniqueViolation } from '../errors'

const COLOR_PATTERN = /^#[0-9a-f]{6}$/

export type CreateLabelInput = { workspaceId: string; name: string; color: string }
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
  if (isUniqueViolation(error, 'labels_workspace_id_name_unique')) {
    throw new DomainError('CONFLICT', `A label named "${name}" already exists`)
  }
  throw error
}

export async function listLabels(db: DbOrTx, workspaceId: string) {
  return db
    .select()
    .from(labels)
    .where(eq(labels.workspaceId, workspaceId))
    .orderBy(asc(labels.name))
}

export async function createLabel(db: DbOrTx, input: CreateLabelInput) {
  const name = normalizeName(input.name)
  const color = normalizeColor(input.color)
  try {
    // A savepoint keeps a duplicate-name failure from aborting an outer transaction.
    return await db.transaction(async (tx) => {
      const [label] = await tx
        .insert(labels)
        .values({ workspaceId: input.workspaceId, name, color })
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
