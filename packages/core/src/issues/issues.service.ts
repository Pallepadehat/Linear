import {
  issueLabels,
  issueRelations,
  issueSubscriptions,
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
  isNotNull,
  isNull,
  lt,
  notInArray,
  or,
  sql,
  aliasedTable,
  type AnyColumn,
  type SQL,
} from 'drizzle-orm'
import { recordActivity, type ActivityActor } from '../activity/activity.service'
import { recordProjectActivity } from '../activity/project-activity.service'
import { issueProjectEvents } from '../activity/project-diff'
import { diffIssue } from '../activity/diff'
import { assignCycle, autoAddCycleId } from '../cycles/cycles.service'
import { DomainError } from '../errors'
import { CLOSED_STATUS_CATEGORIES } from '../relations/roles'
import { subscribeUsers } from '../subscriptions/subscriptions.service'
import { deleteFavoritesOf } from '../favorites/favorites.service'
import { pickDefaultStatus } from '../teams/default-status'
import { listIssueAttachmentIds, releaseAttachments, syncIssueAttachments } from './attachments'
import { nextCompletedAt } from './completed-at'
import { assertValidEstimate } from './estimates'
import { findIssueRef, resolveParent, type ParentRef } from './parent'
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
  /** Must be an open cycle of the issue's team. */
  cycleId?: string | null
  /** Must be on the team's estimate scale; `null` = no estimate. */
  estimate?: number | null
  labelIds?: string[]
  /** A sub-issue of this issue (same workspace, any team). */
  parentId?: string | null
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
  cycleId?: string | null
  estimate?: number | null
  labelIds?: string[]
  /** `null` removes the parent. */
  parentId?: string | null
  dueDate?: IsoDate | null
}

export type DueFilter = 'overdue' | 'dueThisWeek' | 'noDueDate'

export type ListIssuesInput = {
  workspaceId: string
  teamId?: string
  projectId?: string
  cycleId?: string
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
  /** `null` matches issues without a cycle. */
  cycleIds?: (string | null)[]
  /** Any of these labels. */
  labelIds?: string[]
  /** Estimate values; `null` matches no estimate, `'any'` any estimate. */
  estimates?: (number | 'any' | null)[]
  /** Any of these buckets; `overdue` and `dueThisWeek` are relative to `today`. */
  due?: DueFilter[]
  /** The viewer's local day (docs/domain.md → Due dates). */
  today?: IsoDate
  /** Any of these users is subscribed. */
  subscriberIds?: string[]
  /** Who is asking; `isSubscribed` on each issue is for this user. */
  viewerId?: string
  q?: string
  /** `false` leaves out issues that have a parent. Defaults to true. */
  showSubIssues?: boolean
  /** Leaves out this issue and all of its descendants (the parent picker). */
  excludeSubtreeOf?: string
  sort?: IssueSort
  direction?: SortDirection
  cursor?: string | null
  limit: number
}

export type IssueRecord = Awaited<ReturnType<typeof withLabels>>[number]
export type IssueDetailRecord = Awaited<ReturnType<typeof getIssue>>

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
      estimateScale: teams.estimateScale,
      estimateAllowZero: teams.estimateAllowZero,
      key: teams.key,
    })
    .from(teams)
    .where(and(eq(teams.id, input.teamId), eq(teams.workspaceId, input.workspaceId)))
  if (!teamDefaults) throw new DomainError('NOT_FOUND', 'Team not found')

  const priority = input.priority ?? teamDefaults.priority
  assertPriority(priority)
  const estimate = input.estimate ?? null
  assertValidEstimate(teamDefaults, estimate)
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
  let cycleId = input.cycleId ?? null
  if (cycleId) await assignCycle(db, input.workspaceId, input.teamId, cycleId)
  else if (input.cycleId === undefined && status.category === 'started')
    cycleId = await autoAddCycleId(db, input.workspaceId, input.teamId)
  const labelIds = await resolveLabelIds(db, input.workspaceId, input.teamId, input.labelIds ?? [])

  return db.transaction(async (tx) => {
    // The row lock on the team serializes concurrent creates, so numbers are
    // gap-free per transaction that commits and never reused after a delete.
    const [team] = await tx
      .update(teams)
      .set({ issueCounter: sql`${teams.issueCounter} + 1` })
      .where(and(eq(teams.id, input.teamId), eq(teams.workspaceId, input.workspaceId)))
      .returning({ number: teams.issueCounter })
    if (!team) throw new DomainError('NOT_FOUND', 'Team not found')
    const parent = input.parentId
      ? await resolveParent(tx, input.workspaceId, null, input.parentId)
      : null

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
        cycleId,
        estimate,
        parentId: parent?.id ?? null,
        dueDate: input.dueDate ?? null,
        completedAt: nextCompletedAt(status.category, null),
      })
      .returning()
    if (!issue) throw new Error('issue insert returned no row')
    await setIssueLabels(tx, input.workspaceId, issue.id, labelIds)
    await subscribeUsers(tx, issue.id, [input.creatorId, assigneeId])
    await syncIssueAttachments(tx, input.workspaceId, issue.id, issue.description)
    await recordActivity(tx, {
      workspaceId: input.workspaceId,
      issueId: issue.id,
      actor: { type: 'user', id: input.creatorId },
      changes: [{ kind: 'created', from: null, to: null }],
    })
    if (parent) {
      await recordActivity(tx, {
        workspaceId: input.workspaceId,
        issueId: parent.id,
        actor: { type: 'user', id: input.creatorId },
        changes: [{ kind: 'sub_issue', from: null, to: `${teamDefaults.key}-${issue.number}` }],
      })
    }
    await recordIssueProjectChange(
      tx,
      input.workspaceId,
      { type: 'user', id: input.creatorId },
      null,
      {
        issueId: issue.id,
        projectId: issue.projectId,
        identifier: `${teamDefaults.key}-${issue.number}`,
        title: issue.title,
      },
    )
    return issue
  })
}

/** `viewerId` decides `isSubscribed`; without it the field is `false`. */
export async function getIssue(db: DbOrTx, workspaceId: string, id: string, viewerId?: string) {
  const [issue] = await loadIssues(db, workspaceId, eq(issues.id, id), viewerId)
  if (!issue) throw new DomainError('NOT_FOUND', 'Issue not found')
  return withFamily(db, workspaceId, issue, viewerId)
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
  viewerId?: string,
) {
  const [issue] = await loadIssues(
    db,
    workspaceId,
    and(eq(teams.key, teamKey.toUpperCase()), eq(issues.number, number)),
    viewerId,
  )
  if (!issue) throw new DomainError('NOT_FOUND', 'Issue not found')
  return withFamily(db, workspaceId, issue, viewerId)
}

async function withFamily(
  db: DbOrTx,
  workspaceId: string,
  issue: IssueRecord,
  viewerId: string | undefined,
) {
  const [parent] = issue.parentId
    ? await loadIssues(db, workspaceId, eq(issues.id, issue.parentId), viewerId)
    : []
  const children = await loadIssues(db, workspaceId, eq(issues.parentId, issue.id), viewerId, [
    asc(issues.id),
  ])
  return { ...issue, parent: parent ?? null, children }
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
    viewerId: input.viewerId,
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
    input.cycleId ? eq(issues.cycleId, input.cycleId) : undefined,
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
    anyOf(issues.cycleId, input.cycleIds),
    estimateFilter(input.estimates),
    input.showSubIssues === false ? isNull(issues.parentId) : undefined,
    input.excludeSubtreeOf
      ? sql`${issues.id} not in (with recursive subtree(id) as (select ${input.excludeSubtreeOf}::uuid union select child.id from issues child join subtree on child.parent_id = subtree.id) select id from subtree)`
      : undefined,
    input.labelIds?.length
      ? sql`exists (select 1 from ${issueLabels} where ${issueLabels.issueId} = ${issues.id} and ${inArray(issueLabels.labelId, input.labelIds)})`
      : undefined,
    dueFilter(input.due, input.today),
    input.subscriberIds?.length
      ? sql`exists (select 1 from ${issueSubscriptions} where ${issueSubscriptions.issueId} = ${issues.id} and ${eq(issueSubscriptions.workspaceId, input.workspaceId)} and ${inArray(issueSubscriptions.userId, input.subscriberIds)})`
      : undefined,
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

/** Values OR'd together: specific points, `null` for none, `'any'` for any estimate. */
function estimateFilter(values: (number | 'any' | null)[] | undefined) {
  if (!values?.length) return undefined
  const points = values.filter((value): value is number => typeof value === 'number')
  return or(
    points.length ? inArray(issues.estimate, points) : undefined,
    values.includes(null) ? isNull(issues.estimate) : undefined,
    values.includes('any') ? isNotNull(issues.estimate) : undefined,
  )
}

function sortOrder(sort: IssueSort, direction: SortDirection) {
  if (sort === 'estimate') {
    // Ascending rank in both directions; "No estimate" ranks past every value
    // (estimates are 0–100), so it stays last either way.
    const rank =
      direction === 'desc'
        ? sql<number>`coalesce(-${issues.estimate}, 1)`
        : sql<number>`coalesce(${issues.estimate}, 101)`
    return rankOrder(rank)
  }
  if (sort === 'priority') {
    // Rank 1 is the first group shown; "No priority" (0) is 5, last in both directions.
    const rank =
      direction === 'desc'
        ? sql<number>`case when ${issues.priority} = 0 then 5 else ${issues.priority} end`
        : sql<number>`case when ${issues.priority} = 0 then 5 else 5 - ${issues.priority} end`
    return rankOrder(rank)
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

/** Ascending by an integer rank; within a rank, newest first. */
function rankOrder(rank: SQL<number>) {
  return {
    orderBy: [asc(rank), desc(issues.id)],
    cursorValue: sql<string>`(${rank})::text`,
    after: (cursor: { value: string; id: string }) =>
      or(
        gt(rank, Number(cursor.value)),
        and(eq(rank, Number(cursor.value)), lt(issues.id, cursor.id)),
      ),
  }
}

export async function updateIssue(db: DbOrTx, input: UpdateIssueInput) {
  const { parentChange, projectChange } = await db.transaction(async (tx) => {
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
    let status: Awaited<ReturnType<typeof resolveStatus>> | undefined
    if (input.dueDate !== undefined) {
      assertDueDate(input.dueDate)
      changes.dueDate = input.dueDate
    }
    if (input.statusId !== undefined) {
      status = await resolveStatus(tx, input.workspaceId, current.teamId, input.statusId, null)
      changes.statusId = status.id
      changes.completedAt = nextCompletedAt(status.category, current.completedAt)
    }
    if (input.assigneeId !== undefined) {
      if (input.assigneeId) await assertWorkspaceMember(tx, input.workspaceId, input.assigneeId)
      changes.assigneeId = input.assigneeId
    }
    // Re-saving the same assignee doesn't re-subscribe someone who unsubscribed.
    const newAssigneeId =
      input.assigneeId && input.assigneeId !== current.assigneeId ? input.assigneeId : null
    if (input.projectId !== undefined) {
      if (input.projectId) await assertProject(tx, input.workspaceId, input.projectId)
      changes.projectId = input.projectId
    }
    if (input.cycleId !== undefined) {
      if (input.cycleId) await assignCycle(tx, input.workspaceId, current.teamId, input.cycleId)
      changes.cycleId = input.cycleId
    } else if (
      status?.category === 'started' &&
      status.id !== current.statusId &&
      !current.cycleId
    ) {
      // Auto-add (docs/domain.md → Cycles): only when the cycle isn't being set by hand.
      const cycleId = await autoAddCycleId(tx, input.workspaceId, current.teamId)
      if (cycleId) changes.cycleId = cycleId
    }
    // Only a changed value is checked, so an issue keeps an estimate that is no
    // longer on the scale (after a scale change) while other fields are edited.
    if (input.estimate !== undefined && input.estimate !== current.estimate) {
      const [team] = await tx
        .select({
          estimateScale: teams.estimateScale,
          estimateAllowZero: teams.estimateAllowZero,
        })
        .from(teams)
        .where(eq(teams.id, current.teamId))
      if (!team) throw new DomainError('NOT_FOUND', 'Team not found')
      assertValidEstimate(team, input.estimate)
      changes.estimate = input.estimate
    }
    let parentChange: { from: ParentRef | null; to: ParentRef | null } | null = null
    if (input.parentId !== undefined && input.parentId !== current.parentId) {
      const to = input.parentId
        ? await resolveParent(tx, input.workspaceId, current.id, input.parentId)
        : null
      const from = current.parentId
        ? ((await findIssueRef(tx, input.workspaceId, current.parentId)) ?? null)
        : null
      changes.parentId = to?.id ?? null
      parentChange = { from, to }
    }

    const labelIds =
      input.labelIds === undefined
        ? undefined
        : await resolveLabelIds(tx, input.workspaceId, current.teamId, input.labelIds)
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
    if (newAssigneeId) await subscribeUsers(tx, current.id, [newAssigneeId])
    await recordActivity(tx, {
      workspaceId: input.workspaceId,
      issueId: current.id,
      actor: input.actor,
      changes: activity,
    })
    if (parentChange) {
      await recordParentChange(tx, input.workspaceId, input.actor, current, parentChange)
    }
    let projectChange: { from: string | null; to: string | null } | null = null
    if (changes.projectId !== undefined && changes.projectId !== current.projectId) {
      projectChange = { from: current.projectId, to: changes.projectId }
      const ref = await findIssueRef(tx, input.workspaceId, current.id)
      if (ref)
        await recordIssueProjectChange(tx, input.workspaceId, input.actor, current.projectId, {
          issueId: current.id,
          projectId: changes.projectId,
          identifier: ref.identifier,
          title: changes.title ?? current.title,
        })
    }
    return { parentChange, projectChange }
  })
  const issue = await getIssue(
    db,
    input.workspaceId,
    input.id,
    input.actor.type === 'user' ? input.actor.id : undefined,
  )
  return {
    ...issue,
    /** Old and new parent ids when the parent changed, so callers can notify both. */
    parentChange: parentChange
      ? { from: parentChange.from?.id ?? null, to: parentChange.to?.id ?? null }
      : null,
    /** Old and new project ids when the project changed; both feeds got an entry. */
    projectChange,
  }
}

/** `project.issue_removed` on the old project and `project.issue_added` on the new one. */
async function recordIssueProjectChange(
  tx: DbOrTx,
  workspaceId: string,
  actor: ActivityActor,
  fromProjectId: string | null,
  issue: { issueId: string; projectId: string | null; identifier: string; title: string },
) {
  const { projectId, ...ref } = issue
  for (const { projectId: target, event } of issueProjectEvents(fromProjectId, projectId, ref)) {
    await recordProjectActivity(tx, { workspaceId, projectId: target, actor, events: [event] })
  }
}

/**
 * `parent` on the child (parent identifiers), `sub_issue` on the old and new
 * parent (the child's identifier). Identifiers are stored because team keys never
 * change, so the timeline can name issues without loading them.
 */
async function recordParentChange(
  tx: DbOrTx,
  workspaceId: string,
  actor: ActivityActor,
  child: { id: string },
  change: { from: ParentRef | null; to: ParentRef | null },
) {
  const childRef = await findIssueRef(tx, workspaceId, child.id)
  if (!childRef) return
  await recordActivity(tx, {
    workspaceId,
    issueId: child.id,
    actor,
    changes: [
      { kind: 'parent', from: change.from?.identifier ?? null, to: change.to?.identifier ?? null },
    ],
  })
  if (change.from) {
    await recordActivity(tx, {
      workspaceId,
      issueId: change.from.id,
      actor,
      changes: [{ kind: 'sub_issue', from: childRef.identifier, to: null }],
    })
  }
  if (change.to) {
    await recordActivity(tx, {
      workspaceId,
      issueId: change.to.id,
      actor,
      changes: [{ kind: 'sub_issue', from: null, to: childRef.identifier }],
    })
  }
}

/**
 * Deletes the issue (labels, links, comments cascade; favorites explicitly) and marks its attachments
 * deleted unless another issue still references them. The caller enqueues
 * `delete-objects` for each `deletedUploadIds` entry after the commit.
 */
export async function deleteIssue(db: DbOrTx, workspaceId: string, id: string) {
  return db.transaction(async (tx) => {
    const attachmentIds = await listIssueAttachmentIds(tx, workspaceId, id)
    // Sub-issues lose their parent (`ON DELETE SET NULL`); returned so callers can notify them.
    const children = await tx
      .select({ id: issues.id })
      .from(issues)
      .where(and(eq(issues.workspaceId, workspaceId), eq(issues.parentId, id)))
    const [issue] = await tx
      .delete(issues)
      .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, id)))
      .returning({ id: issues.id, parentId: issues.parentId })
    if (!issue) throw new DomainError('NOT_FOUND', 'Issue not found')
    await deleteFavoritesOf(tx, workspaceId, 'issue', [issue.id])
    const deletedUploadIds = await releaseAttachments(tx, workspaceId, attachmentIds)
    return {
      id: issue.id,
      parentId: issue.parentId,
      childIds: children.map((child) => child.id),
      deletedUploadIds,
    }
  })
}

/** Issues with their team key, status and labels, scoped to the workspace. */
async function loadIssues(
  db: DbOrTx,
  workspaceId: string,
  where: SQL | undefined,
  viewerId: string | undefined,
  orderBy?: SQL[],
) {
  return withLabels(
    db,
    workspaceId,
    await selectIssueRows(db, workspaceId, { where, viewerId, orderBy }),
  )
}

type IssueRowsQuery = {
  where: SQL | undefined
  orderBy?: SQL[]
  /** Selected alongside each row so the last one can become the next cursor. */
  cursorValue?: SQL<string>
  limit?: number
  viewerId?: string
}

/**
 * `blocks` relations of the listed issue whose other side is still open: as the
 * blocked issue (`relatedIssueId`) these are its blockers, as the source its blockees.
 */
function openBlockCount(side: 'issueId' | 'relatedIssueId') {
  const name = side === 'issueId' ? 'blocked_issue' : 'blocking_issue'
  const other = aliasedTable(issues, name)
  const otherStatus = aliasedTable(workflowStatuses, `${name}_status`)
  const otherSide = side === 'issueId' ? issueRelations.relatedIssueId : issueRelations.issueId
  return sql<number>`(select count(*)::int from ${issueRelations}
    inner join ${issues} as ${sql.identifier(name)} on ${other.id} = ${otherSide}
    inner join ${workflowStatuses} as ${sql.identifier(`${name}_status`)} on ${otherStatus.id} = ${other.statusId}
    where ${issueRelations[side]} = ${issues.id}
      and ${issueRelations.type} = 'blocks'
      and ${otherStatus.category} not in ${CLOSED_STATUS_CATEGORIES})`
}

async function selectIssueRows(db: DbOrTx, workspaceId: string, query: IssueRowsQuery) {
  const select = db
    .select({
      issue: issues,
      teamKey: teams.key,
      status: workflowStatuses,
      blockedByCount: openBlockCount('relatedIssueId'),
      blockingCount: openBlockCount('issueId'),
      cursorValue: query.cursorValue ?? sql<string>`''`,
      isSubscribed: query.viewerId
        ? sql<boolean>`exists (select 1 from ${issueSubscriptions} where ${issueSubscriptions.issueId} = ${issues.id} and ${eq(issueSubscriptions.userId, query.viewerId)})`
        : sql<boolean>`false`,
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
  const progress = await subIssueProgress(
    db,
    workspaceId,
    rows.map((row) => row.issue.id),
  )

  return rows.map(({ issue, teamKey, status, isSubscribed, blockedByCount, blockingCount }) => ({
    ...issue,
    identifier: `${teamKey}-${issue.number}`,
    status,
    isSubscribed,
    blockedByCount,
    blockingCount,
    labels: attached.filter((row) => row.issueId === issue.id).map((row) => row.label),
    subIssueProgress: progress.get(issue.id) ?? null,
  }))
}

/**
 * Per parent: `done` counts sub-issues in a `completed` status; `total` leaves
 * canceled ones out. Issues without sub-issues are missing from the map.
 */
async function subIssueProgress(db: DbOrTx, workspaceId: string, parentIds: string[]) {
  const rows = await db
    .select({
      parentId: issues.parentId,
      done: sql<number>`(count(*) filter (where ${workflowStatuses.category} = 'completed'))::int`,
      total: sql<number>`(count(*) filter (where ${workflowStatuses.category} <> 'canceled'))::int`,
    })
    .from(issues)
    .innerJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
    .where(and(eq(issues.workspaceId, workspaceId), inArray(issues.parentId, parentIds)))
    .groupBy(issues.parentId)
  return new Map(
    rows.flatMap((row) =>
      row.parentId ? [[row.parentId, { done: row.done, total: row.total }] as const] : [],
    ),
  )
}

/** Workspace labels, or the issue team's own labels; anything else is BAD_REQUEST. */
async function resolveLabelIds(
  db: DbOrTx,
  workspaceId: string,
  teamId: string,
  labelIds: string[],
) {
  const unique = [...new Set(labelIds)]
  if (unique.length === 0) return unique
  const found = await db
    .select({ id: labels.id })
    .from(labels)
    .where(
      and(
        eq(labels.workspaceId, workspaceId),
        or(isNull(labels.teamId), eq(labels.teamId, teamId)),
        inArray(labels.id, unique),
      ),
    )
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
