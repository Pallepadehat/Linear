import {
  issueLabels,
  issues,
  projects,
  labels,
  teams,
  workflowStatuses,
  workspaceMembers,
  type DbOrTx,
  type StatusCategory,
} from '@linear/db'
import {
  and,
  asc,
  between,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  lt,
  notInArray,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from 'drizzle-orm'
import { recordActivity, type ActivityActor } from '../activity/activity.service'
import { diffIssue } from '../activity/diff'
import { DomainError } from '../errors'
import { pickDefaultStatus } from '../teams/default-status'
import { listIssueAttachmentIds, releaseAttachments, syncIssueAttachments } from './attachments'
import { nextCompletedAt } from './completed-at'
import { endOfWeek, isIsoDate, type IsoDate } from './due-dates'
import { ISSUE_PRIORITIES, type IssuePriority } from './priorities'
import {
  decodeListCursor,
  encodeListCursor,
  escapeLike,
  parseIdentifierQuery,
  type IssueSort,
  type SortDirection,
} from './list-query'

export type CreateIssueInput = {
  workspaceId: string
  teamId: string
  creatorId: string
  title: string
  description?: string | null
  /** Omitted status, priority and assignee use the team's issue defaults (domain.md). */
  statusId?: string
  priority?: number
  /** `null` leaves the issue unassigned even when the team has a default assignee. */
  assigneeId?: string | null
  projectId?: string | null
  labelIds?: string[]
  /** `YYYY-MM-DD`; null or omitted = no due date. */
  dueDate?: IsoDate | null
}

/** Omitted fields are left unchanged; `labelIds` replaces the whole set. */
export type UpdateIssueInput = {
  workspaceId: string
  id: string
  actor: ActivityActor
  title?: string
  description?: string | null
  statusId?: string
  priority?: number
  assigneeId?: string | null
  projectId?: string | null
  labelIds?: string[]
  dueDate?: IsoDate | null
}

export type DueFilter = 'overdue' | 'dueThisWeek' | 'noDueDate'

export type ListIssuesInput = {
  workspaceId: string
  teamId?: string
  projectId?: string
  assigneeId?: string
  creatorId?: string
  statusIds?: string[]
  /** The issue's status category is one of these. */
  statusCategories?: StatusCategory[]
  priorities?: number[]
  /** `null` matches unassigned issues. */
  assigneeIds?: (string | null)[]
  /** `null` matches issues without a project. */
  projectIds?: (string | null)[]
  /** Any of these labels. */
  labelIds?: string[]
  /** Any of these buckets; `overdue` and `dueThisWeek` are relative to `today`. */
  due?: DueFilter[]
  /** The viewer's local day (docs/domain.md → Due dates). */
  today?: IsoDate
  q?: string
  sort?: IssueSort
  direction?: SortDirection
  cursor?: string | null
  limit: number
}

export type IssueRecord = Awaited<ReturnType<typeof withLabels>>[number]

function normalizeTitle(title: string) {
  const trimmed = title.trim()
  if (trimmed.length === 0) throw new DomainError('BAD_REQUEST', 'Issue title is required')
  return trimmed
}

function assertDueDate(dueDate: string | null | undefined) {
  if (dueDate && !isIsoDate(dueDate)) {
    throw new DomainError('BAD_REQUEST', 'Due date must be a date like 2026-11-07')
  }
}

function assertPriority(priority: number) {
  if (!ISSUE_PRIORITIES.includes(priority as IssuePriority)) {
    throw new DomainError('BAD_REQUEST', 'Priority must be between 0 and 4')
  }
}

export async function createIssue(db: DbOrTx, input: CreateIssueInput) {
  const title = normalizeTitle(input.title)
  const [teamDefaults] = await db
    .select({
      statusId: teams.defaultStatusId,
      priority: teams.defaultPriority,
      assigneeId: teams.defaultAssigneeId,
    })
    .from(teams)
    .where(and(eq(teams.id, input.teamId), eq(teams.workspaceId, input.workspaceId)))
  if (!teamDefaults) throw new DomainError('NOT_FOUND', 'Team not found')

  const priority = input.priority ?? teamDefaults.priority
  assertPriority(priority)
  assertDueDate(input.dueDate)
  const status = await resolveStatus(
    db,
    input.workspaceId,
    input.teamId,
    input.statusId ?? null,
    teamDefaults.statusId,
  )
  let assigneeId = input.assigneeId ?? null
  if (input.assigneeId === undefined && teamDefaults.assigneeId) {
    // A default assignee who has since left the workspace is skipped, not an error.
    assigneeId = (await isWorkspaceMember(db, input.workspaceId, teamDefaults.assigneeId))
      ? teamDefaults.assigneeId
      : null
  } else if (assigneeId) {
    await assertWorkspaceMember(db, input.workspaceId, assigneeId)
  }
  if (input.projectId) await assertProject(db, input.workspaceId, input.projectId)
  const labelIds = await resolveLabelIds(db, input.workspaceId, input.labelIds ?? [])

  return db.transaction(async (tx) => {
    // The row lock on the team serializes concurrent creates, so numbers are
    // gap-free per transaction that commits and never reused after a delete.
    const [team] = await tx
      .update(teams)
      .set({ issueCounter: sql`${teams.issueCounter} + 1` })
      .where(and(eq(teams.id, input.teamId), eq(teams.workspaceId, input.workspaceId)))
      .returning({ number: teams.issueCounter })
    if (!team) throw new DomainError('NOT_FOUND', 'Team not found')

    const [issue] = await tx
      .insert(issues)
      .values({
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        number: team.number,
        title,
        description: input.description ?? null,
        statusId: status.id,
        priority,
        assigneeId,
        creatorId: input.creatorId,
        projectId: input.projectId ?? null,
        dueDate: input.dueDate ?? null,
        completedAt: nextCompletedAt(status.category, null),
      })
      .returning()
    if (!issue) throw new Error('issue insert returned no row')
    await setIssueLabels(tx, input.workspaceId, issue.id, labelIds)
    await syncIssueAttachments(tx, input.workspaceId, issue.id, issue.description)
    await recordActivity(tx, {
      workspaceId: input.workspaceId,
      issueId: issue.id,
      actor: { type: 'user', id: input.creatorId },
      changes: [{ kind: 'created', from: null, to: null }],
    })
    return issue
  })
}

export async function getIssue(db: DbOrTx, workspaceId: string, id: string) {
  const [issue] = await loadIssues(db, workspaceId, eq(issues.id, id))
  if (!issue) throw new DomainError('NOT_FOUND', 'Issue not found')
  return issue
}

/** Whether `id` is an issue of this workspace (a cheap check, no issue loaded). */
export async function issueExistsInWorkspace(db: DbOrTx, workspaceId: string, id: string) {
  const [row] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, id)))
    .limit(1)
  return Boolean(row)
}

/** `teamKey` is expected uppercase (identifier lookups are case-insensitive upstream). */
export async function getIssueByIdentifier(
  db: DbOrTx,
  workspaceId: string,
  teamKey: string,
  number: number,
) {
  const [issue] = await loadIssues(
    db,
    workspaceId,
    and(eq(teams.key, teamKey.toUpperCase()), eq(issues.number, number)),
  )
  if (!issue) throw new DomainError('NOT_FOUND', 'Issue not found')
  return issue
}

/**
 * Keyset-paginated: each sort orders by its key and then by id, and the cursor
 * carries both values of the last row, so rows inserted or edited elsewhere in
 * the list never shift the pages after it.
 */
export async function listIssues(db: DbOrTx, input: ListIssuesInput) {
  const sort = input.sort ?? 'createdAt'
  const direction = input.direction ?? 'desc'
  const cursor = input.cursor ? decodeListCursor(input.cursor, sort, direction) : null
  if (input.today !== undefined && !isIsoDate(input.today)) {
    throw new DomainError('BAD_REQUEST', 'today must be a date like 2026-11-07')
  }
  if (!input.today && input.due?.some((bucket) => bucket !== 'noDueDate')) {
    throw new DomainError('BAD_REQUEST', 'Relative due date filters need today')
  }
  const order = sortOrder(sort, direction)

  const rows = await selectIssueRows(db, input.workspaceId, {
    where: and(listFilter(input), cursor ? order.after(cursor) : undefined),
    orderBy: order.orderBy,
    cursorValue: order.cursorValue,
    limit: input.limit + 1,
  })
  const page = rows.slice(0, input.limit)
  const last = page.at(-1)
  const nextCursor =
    rows.length > input.limit && last
      ? encodeListCursor(sort, direction, { value: last.cursorValue, id: last.issue.id })
      : null
  return { items: await withLabels(db, input.workspaceId, page), nextCursor }
}

function listFilter(input: ListIssuesInput) {
  const identifier = input.q ? parseIdentifierQuery(input.q) : null
  const search = input.q?.trim()
  return and(
    input.teamId ? eq(issues.teamId, input.teamId) : undefined,
    input.projectId ? eq(issues.projectId, input.projectId) : undefined,
    input.assigneeId ? eq(issues.assigneeId, input.assigneeId) : undefined,
    input.creatorId ? eq(issues.creatorId, input.creatorId) : undefined,
    input.statusIds?.length ? inArray(issues.statusId, input.statusIds) : undefined,
    // `workflowStatuses` is joined in `selectIssueRows`.
    input.statusCategories?.length
      ? inArray(workflowStatuses.category, input.statusCategories)
      : undefined,
    input.priorities?.length ? inArray(issues.priority, input.priorities) : undefined,
    anyOf(issues.assigneeId, input.assigneeIds),
    anyOf(issues.projectId, input.projectIds),
    input.labelIds?.length
      ? sql`exists (select 1 from ${issueLabels} where ${issueLabels.issueId} = ${issues.id} and ${inArray(issueLabels.labelId, input.labelIds)})`
      : undefined,
    dueFilter(input.due, input.today),
    search
      ? or(
          ilike(issues.title, `%${escapeLike(search)}%`),
          identifier
            ? and(eq(teams.key, identifier.teamKey), eq(issues.number, identifier.number))
            : undefined,
        )
      : undefined,
  )
}

/** OR of the due date buckets; `today` is checked by the caller when one needs it. */
function dueFilter(buckets: DueFilter[] | undefined, today: IsoDate | undefined) {
  if (!buckets?.length) return undefined
  return or(
    ...[...new Set(buckets)].map((bucket) => {
      if (bucket === 'noDueDate') return isNull(issues.dueDate)
      if (bucket === 'overdue') {
        return and(
          lt(issues.dueDate, today!),
          notInArray(workflowStatuses.category, ['completed', 'canceled']),
        )
      }
      return between(issues.dueDate, today!, endOfWeek(today!))
    }),
  )
}

/** `IN (...)` that also matches NULL when the list contains `null`. */
function anyOf(column: AnyColumn, values: (string | null)[] | undefined) {
  if (!values?.length) return undefined
  const ids = values.filter((value): value is string => value !== null)
  return or(
    ids.length ? inArray(column, ids) : undefined,
    values.includes(null) ? isNull(column) : undefined,
  )
}

function sortOrder(sort: IssueSort, direction: SortDirection) {
  if (sort === 'priority') {
    // Rank 1 is the first group shown; "No priority" (0) is 5, last in both directions.
    const rank =
      direction === 'desc'
        ? sql<number>`case when ${issues.priority} = 0 then 5 else ${issues.priority} end`
        : sql<number>`case when ${issues.priority} = 0 then 5 else 5 - ${issues.priority} end`
    return {
      // Within a priority, newest first.
      orderBy: [asc(rank), desc(issues.id)],
      cursorValue: sql<string>`(${rank})::text`,
      after: (cursor: { value: string; id: string }) =>
        or(
          gt(rank, Number(cursor.value)),
          and(eq(rank, Number(cursor.value)), lt(issues.id, cursor.id)),
        ),
    }
  }
  if (sort === 'dueDate') {
    // No due date becomes ±infinity, so it sorts last in both directions.
    const key =
      direction === 'asc'
        ? sql`coalesce(${issues.dueDate}, 'infinity'::date)`
        : sql`coalesce(${issues.dueDate}, '-infinity'::date)`
    const dir = direction === 'desc' ? desc : asc
    return {
      orderBy: [dir(key), dir(issues.id)],
      cursorValue: sql<string>`(${key})::text`,
      after: (cursor: { value: string; id: string }) => {
        const at = sql`${cursor.value}::date`
        return direction === 'desc'
          ? or(sql`${key} < ${at}`, and(sql`${key} = ${at}`, lt(issues.id, cursor.id)))
          : or(sql`${key} > ${at}`, and(sql`${key} = ${at}`, gt(issues.id, cursor.id)))
      },
    }
  }
  const column = sort === 'createdAt' ? issues.createdAt : issues.updatedAt
  const dir = direction === 'desc' ? desc : asc
  const beyond = direction === 'desc' ? lt : gt
  const micros = sql<string>`(extract(epoch from ${column}) * 1000000)::bigint::text`
  return {
    orderBy: [dir(column), dir(issues.id)],
    cursorValue: micros,
    after: (cursor: { value: string; id: string }) => {
      const at = sql`(timestamptz 'epoch' + ${cursor.value}::bigint * interval '1 microsecond')`
      return or(
        direction === 'desc' ? sql`${column} < ${at}` : sql`${column} > ${at}`,
        and(sql`${column} = ${at}`, beyond(issues.id, cursor.id)),
      )
    },
  }
}

export async function updateIssue(db: DbOrTx, input: UpdateIssueInput) {
  await db.transaction(async (tx) => {
    // Locking the row keeps `completedAt` consistent with concurrent status changes.
    const [current] = await tx
      .select()
      .from(issues)
      .where(and(eq(issues.workspaceId, input.workspaceId), eq(issues.id, input.id)))
      .for('update')
    if (!current) throw new DomainError('NOT_FOUND', 'Issue not found')

    // Always bumped, so a labels-only change still counts as an update.
    const changes: Partial<typeof issues.$inferInsert> = { updatedAt: new Date() }
    if (input.title !== undefined) changes.title = normalizeTitle(input.title)
    if (input.description !== undefined) changes.description = input.description
    if (input.priority !== undefined) {
      assertPriority(input.priority)
      changes.priority = input.priority
    }
    if (input.dueDate !== undefined) {
      assertDueDate(input.dueDate)
      changes.dueDate = input.dueDate
    }
    if (input.statusId !== undefined) {
      const status = await resolveStatus(
        tx,
        input.workspaceId,
        current.teamId,
        input.statusId,
        null,
      )
      changes.statusId = status.id
      changes.completedAt = nextCompletedAt(status.category, current.completedAt)
    }
    if (input.assigneeId !== undefined) {
      if (input.assigneeId) await assertWorkspaceMember(tx, input.workspaceId, input.assigneeId)
      changes.assigneeId = input.assigneeId
    }
    if (input.projectId !== undefined) {
      if (input.projectId) await assertProject(tx, input.workspaceId, input.projectId)
      changes.projectId = input.projectId
    }

    const labelIds =
      input.labelIds === undefined
        ? undefined
        : await resolveLabelIds(tx, input.workspaceId, input.labelIds)
    const currentLabels = await tx
      .select({ labelId: issueLabels.labelId })
      .from(issueLabels)
      .where(
        and(eq(issueLabels.workspaceId, input.workspaceId), eq(issueLabels.issueId, current.id)),
      )
    const activity = diffIssue(
      { ...current, labelIds: currentLabels.map((row) => row.labelId) },
      { ...changes, labelIds },
    )

    await tx.update(issues).set(changes).where(eq(issues.id, current.id))
    if (input.description !== undefined) {
      await syncIssueAttachments(tx, input.workspaceId, current.id, input.description)
    }
    if (labelIds !== undefined) {
      await tx
        .delete(issueLabels)
        .where(
          and(eq(issueLabels.workspaceId, input.workspaceId), eq(issueLabels.issueId, current.id)),
        )
      await setIssueLabels(tx, input.workspaceId, current.id, labelIds)
    }
    await recordActivity(tx, {
      workspaceId: input.workspaceId,
      issueId: current.id,
      actor: input.actor,
      changes: activity,
    })
  })
  return getIssue(db, input.workspaceId, input.id)
}

/**
 * Deletes the issue (labels, links, comments cascade) and marks its attachments
 * deleted unless another issue still references them. The caller enqueues
 * `delete-objects` for each `deletedUploadIds` entry after the commit.
 */
export async function deleteIssue(db: DbOrTx, workspaceId: string, id: string) {
  return db.transaction(async (tx) => {
    const attachmentIds = await listIssueAttachmentIds(tx, workspaceId, id)
    const [issue] = await tx
      .delete(issues)
      .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, id)))
      .returning({ id: issues.id })
    if (!issue) throw new DomainError('NOT_FOUND', 'Issue not found')
    const deletedUploadIds = await releaseAttachments(tx, workspaceId, attachmentIds)
    return { id: issue.id, deletedUploadIds }
  })
}

/** Issues with their team key, status and labels, scoped to the workspace. */
async function loadIssues(db: DbOrTx, workspaceId: string, where: SQL | undefined) {
  return withLabels(db, workspaceId, await selectIssueRows(db, workspaceId, { where }))
}

type IssueRowsQuery = {
  where: SQL | undefined
  orderBy?: SQL[]
  /** Selected alongside each row so the last one can become the next cursor. */
  cursorValue?: SQL<string>
  limit?: number
}

async function selectIssueRows(db: DbOrTx, workspaceId: string, query: IssueRowsQuery) {
  const select = db
    .select({
      issue: issues,
      teamKey: teams.key,
      status: workflowStatuses,
      cursorValue: query.cursorValue ?? sql<string>`''`,
    })
    .from(issues)
    .innerJoin(teams, eq(teams.id, issues.teamId))
    .innerJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
    .where(and(eq(issues.workspaceId, workspaceId), query.where))
    .orderBy(...(query.orderBy ?? [desc(issues.id)]))
  return query.limit === undefined ? select : select.limit(query.limit)
}

type IssueRow = Awaited<ReturnType<typeof selectIssueRows>>[number]

async function withLabels(db: DbOrTx, workspaceId: string, rows: IssueRow[]) {
  if (rows.length === 0) return []
  const attached = await db
    .select({ issueId: issueLabels.issueId, label: labels })
    .from(issueLabels)
    .innerJoin(labels, eq(labels.id, issueLabels.labelId))
    .where(
      and(
        eq(issueLabels.workspaceId, workspaceId),
        inArray(
          issueLabels.issueId,
          rows.map((row) => row.issue.id),
        ),
      ),
    )
    .orderBy(asc(labels.name))

  return rows.map(({ issue, teamKey, status }) => ({
    ...issue,
    identifier: `${teamKey}-${issue.number}`,
    status,
    labels: attached.filter((row) => row.issueId === issue.id).map((row) => row.label),
  }))
}

async function resolveLabelIds(db: DbOrTx, workspaceId: string, labelIds: string[]) {
  const unique = [...new Set(labelIds)]
  if (unique.length === 0) return unique
  const found = await db
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.workspaceId, workspaceId), inArray(labels.id, unique)))
  if (found.length !== unique.length) throw new DomainError('BAD_REQUEST', 'Label not found')
  return unique
}

async function setIssueLabels(
  db: DbOrTx,
  workspaceId: string,
  issueId: string,
  labelIds: string[],
) {
  if (labelIds.length === 0) return
  await db
    .insert(issueLabels)
    .values(labelIds.map((labelId) => ({ workspaceId, issueId, labelId })))
}

async function assertProject(db: DbOrTx, workspaceId: string, projectId: string) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)))
  if (!project) throw new DomainError('BAD_REQUEST', 'Project not found')
}

async function resolveStatus(
  db: DbOrTx,
  workspaceId: string,
  teamId: string,
  statusId: string | null,
  defaultStatusId: string | null,
) {
  const scope = and(
    eq(workflowStatuses.workspaceId, workspaceId),
    eq(workflowStatuses.teamId, teamId),
  )

  if (statusId) {
    const [status] = await db
      .select()
      .from(workflowStatuses)
      .where(and(scope, eq(workflowStatuses.id, statusId)))
    if (!status) throw new DomainError('BAD_REQUEST', 'Status does not belong to this team')
    return status
  }

  const statuses = await db.select().from(workflowStatuses).where(scope)
  const status = pickDefaultStatus(statuses, defaultStatusId)
  if (!status) throw new DomainError('BAD_REQUEST', 'Team has no status for new issues')
  return status
}

async function isWorkspaceMember(db: DbOrTx, workspaceId: string, userId: string) {
  const [member] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
  return Boolean(member)
}

async function assertWorkspaceMember(db: DbOrTx, workspaceId: string, userId: string) {
  if (!(await isWorkspaceMember(db, workspaceId, userId))) {
    throw new DomainError('BAD_REQUEST', 'Assignee is not a member of this workspace')
  }
}
