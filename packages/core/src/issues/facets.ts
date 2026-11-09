import {
  cycles,
  issueLabels,
  issues,
  projects,
  teams,
  workflowStatuses,
  type DbOrTx,
} from '@linear/db'
import { and, count, desc, eq } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { DomainError } from '../errors'
import { listFilter, type IssueFilterInput } from './issues.service'

/**
 * Issue counts per assignee, label, priority and project for the issues the list
 * would show with the same scope and filters (the Details panel). Each dimension is
 * one grouped `COUNT(*)`, most common value first.
 */
export async function getIssueFacets(db: DbOrTx, input: IssueFilterInput) {
  await assertScope(db, input)
  const where = and(eq(issues.workspaceId, input.workspaceId), listFilter(input))

  const grouped = <T extends PgColumn>(column: T) => {
    const total = count()
    return db
      .select({ key: column, count: total })
      .from(issues)
      .innerJoin(teams, eq(teams.id, issues.teamId))
      .innerJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
      .where(where)
      .groupBy(column)
      .orderBy(desc(total), column)
  }

  const [assignees, priorities, projectRows, statusRows, labelRows] = await Promise.all([
    grouped(issues.assigneeId),
    grouped(issues.priority),
    grouped(issues.projectId),
    grouped(issues.statusId),
    db
      .select({ key: issueLabels.labelId, count: count() })
      .from(issueLabels)
      .innerJoin(issues, eq(issues.id, issueLabels.issueId))
      .innerJoin(teams, eq(teams.id, issues.teamId))
      .innerJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
      .where(and(eq(issueLabels.workspaceId, input.workspaceId), where))
      .groupBy(issueLabels.labelId)
      .orderBy(desc(count()), issueLabels.labelId),
  ])

  return {
    assignees: assignees.map((row) => ({ id: row.key, count: row.count })),
    labels: labelRows.map((row) => ({ id: row.key, count: row.count })),
    priorities: priorities.map((row) => ({ value: row.key, count: row.count })),
    projects: projectRows.map((row) => ({ id: row.key, count: row.count })),
    statuses: statusRows.map((row) => ({ id: row.key, count: row.count })),
  }
}

/** A team, project or cycle scope from another workspace is NOT_FOUND, so ids can't be probed. */
async function assertScope(db: DbOrTx, input: IssueFilterInput) {
  if (input.teamId) {
    const [team] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.workspaceId, input.workspaceId), eq(teams.id, input.teamId)))
    if (!team) throw new DomainError('NOT_FOUND', 'Team not found')
  }
  if (input.projectId) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.workspaceId, input.workspaceId), eq(projects.id, input.projectId)))
    if (!project) throw new DomainError('NOT_FOUND', 'Project not found')
  }
  if (input.cycleId) {
    const [cycle] = await db
      .select({ id: cycles.id })
      .from(cycles)
      .where(and(eq(cycles.workspaceId, input.workspaceId), eq(cycles.id, input.cycleId)))
    if (!cycle) throw new DomainError('NOT_FOUND', 'Cycle not found')
  }
}
