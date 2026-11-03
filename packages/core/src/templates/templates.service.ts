import {
  issueTemplates,
  labels,
  projects,
  teams,
  workflowStatuses,
  workspaceMembers,
  type DbOrTx,
} from '@linear/db'
import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { DomainError, isUniqueViolation } from '../errors'
import { ISSUE_PRIORITIES, type IssuePriority } from '../issues/priorities'

/** The properties a template prefills; omitted on update = unchanged, null = cleared. */
type TemplateFields = {
  title?: string
  description?: string | null
  statusId?: string | null
  priority?: number | null
  assigneeId?: string | null
  projectId?: string | null
  labelIds?: string[]
}

export type CreateTemplateInput = TemplateFields & {
  workspaceId: string
  createdById: string
  name: string
  /** `null` or omitted = workspace template. */
  teamId?: string | null
}

export type UpdateTemplateInput = TemplateFields & {
  workspaceId: string
  id: string
  name?: string
}

const UNIQUE_NAME = 'issue_templates_workspace_id_team_id_name_unique'

function normalizeName(name: string) {
  const trimmed = name.trim()
  if (trimmed.length === 0) throw new DomainError('BAD_REQUEST', 'Template name is required')
  return trimmed
}

function duplicateName(error: unknown, name: string | undefined): never {
  if (isUniqueViolation(error, UNIQUE_NAME)) {
    throw new DomainError('CONFLICT', `A template named "${name}" already exists`)
  }
  throw error
}

const templateColumns = {
  template: issueTemplates,
  statusCategory: workflowStatuses.category,
}

async function loadTemplates(db: DbOrTx, workspaceId: string, where: ReturnType<typeof and>) {
  const rows = await db
    .select(templateColumns)
    .from(issueTemplates)
    .leftJoin(workflowStatuses, eq(workflowStatuses.id, issueTemplates.statusId))
    .where(and(eq(issueTemplates.workspaceId, workspaceId), where))
    // Workspace templates first, then the team's; by name within each.
    .orderBy(sql`${issueTemplates.teamId} is not null`, asc(issueTemplates.name))

  // Label ids carry no FK, so drop the ones deleted since the template was saved.
  const referenced = [...new Set(rows.flatMap((r) => r.template.labelIds))]
  const existing = new Set(
    referenced.length === 0
      ? []
      : (
          await db
            .select({ id: labels.id })
            .from(labels)
            .where(and(eq(labels.workspaceId, workspaceId), inArray(labels.id, referenced)))
        ).map((l) => l.id),
  )
  return rows.map(({ template, statusCategory }) => ({
    ...template,
    statusCategory: template.statusId ? statusCategory : null,
    labelIds: template.labelIds.filter((id) => existing.has(id)),
  }))
}

export type TemplateRecord = Awaited<ReturnType<typeof loadTemplates>>[number]

/** Workspace templates, plus the team's when `teamId` is given. */
export async function listTemplates(db: DbOrTx, workspaceId: string, teamId?: string) {
  const scope = teamId
    ? or(isNull(issueTemplates.teamId), eq(issueTemplates.teamId, teamId))
    : isNull(issueTemplates.teamId)
  return loadTemplates(db, workspaceId, and(scope))
}

export async function getTemplate(db: DbOrTx, workspaceId: string, id: string) {
  const [template] = await loadTemplates(db, workspaceId, and(eq(issueTemplates.id, id)))
  if (!template) throw new DomainError('NOT_FOUND', 'Template not found')
  return template
}

export async function createTemplate(db: DbOrTx, input: CreateTemplateInput) {
  const name = normalizeName(input.name)
  const teamId = input.teamId ?? null
  if (teamId) await assertTeam(db, input.workspaceId, teamId)
  const fields = await validateFields(db, input.workspaceId, teamId, input)
  try {
    // A savepoint keeps a duplicate-name failure from aborting an outer transaction.
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(issueTemplates)
        .values({
          ...fields,
          workspaceId: input.workspaceId,
          teamId,
          name,
          createdById: input.createdById,
        })
        .returning({ id: issueTemplates.id })
      if (!row) throw new Error('template insert returned no row')
      return row.id
    })
    return getTemplate(db, input.workspaceId, id)
  } catch (error) {
    duplicateName(error, name)
  }
}

export async function updateTemplate(db: DbOrTx, input: UpdateTemplateInput) {
  const [existing] = await db
    .select({ teamId: issueTemplates.teamId })
    .from(issueTemplates)
    .where(and(eq(issueTemplates.workspaceId, input.workspaceId), eq(issueTemplates.id, input.id)))
  if (!existing) throw new DomainError('NOT_FOUND', 'Template not found')
  const name = input.name === undefined ? undefined : normalizeName(input.name)
  const fields = await validateFields(db, input.workspaceId, existing.teamId, input)
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(issueTemplates)
        .set({ ...fields, name })
        .where(
          and(eq(issueTemplates.workspaceId, input.workspaceId), eq(issueTemplates.id, input.id)),
        )
    })
  } catch (error) {
    duplicateName(error, name)
  }
  return getTemplate(db, input.workspaceId, input.id)
}

export async function deleteTemplate(db: DbOrTx, workspaceId: string, id: string) {
  const [template] = await db
    .delete(issueTemplates)
    .where(and(eq(issueTemplates.workspaceId, workspaceId), eq(issueTemplates.id, id)))
    .returning({ id: issueTemplates.id })
  if (!template) throw new DomainError('NOT_FOUND', 'Template not found')
  return template
}

/**
 * Checks every referenced entity belongs to the workspace (NOT_FOUND otherwise, so ids
 * from other workspaces can't be probed) and returns the columns to write. A team
 * template's status must be one of that team's; a workspace template may use any
 * workspace status, resolved by category when used (docs/domain.md → Templates).
 */
async function validateFields(
  db: DbOrTx,
  workspaceId: string,
  teamId: string | null,
  input: TemplateFields,
) {
  if (input.priority != null && !ISSUE_PRIORITIES.includes(input.priority as IssuePriority)) {
    throw new DomainError('BAD_REQUEST', 'Priority must be between 0 and 4')
  }
  if (input.statusId) {
    const [status] = await db
      .select({ teamId: workflowStatuses.teamId })
      .from(workflowStatuses)
      .where(
        and(eq(workflowStatuses.workspaceId, workspaceId), eq(workflowStatuses.id, input.statusId)),
      )
    if (!status) throw new DomainError('NOT_FOUND', 'Status not found')
    if (teamId && status.teamId !== teamId) {
      throw new DomainError('BAD_REQUEST', 'Status does not belong to the template’s team')
    }
  }
  if (input.assigneeId) {
    const [member] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, input.assigneeId),
        ),
      )
    if (!member) throw new DomainError('NOT_FOUND', 'Assignee not found')
  }
  if (input.projectId) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, input.projectId)))
    if (!project) throw new DomainError('NOT_FOUND', 'Project not found')
  }
  const labelIds = input.labelIds && [...new Set(input.labelIds)]
  if (labelIds?.length) {
    const found = await db
      .select({ id: labels.id })
      .from(labels)
      .where(and(eq(labels.workspaceId, workspaceId), inArray(labels.id, labelIds)))
    if (found.length !== labelIds.length) throw new DomainError('NOT_FOUND', 'Label not found')
  }
  return {
    title: input.title?.trim(),
    description: input.description,
    statusId: input.statusId,
    priority: input.priority,
    assigneeId: input.assigneeId,
    projectId: input.projectId,
    labelIds,
  }
}

async function assertTeam(db: DbOrTx, workspaceId: string, teamId: string) {
  const [team] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.workspaceId, workspaceId), eq(teams.id, teamId)))
  if (!team) throw new DomainError('NOT_FOUND', 'Team not found')
}
