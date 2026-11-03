import { issueRelations, issues, teams, workflowStatuses, type DbOrTx } from '@linear/db'
import { aliasedTable, and, asc, eq, inArray } from 'drizzle-orm'
import { recordActivity } from '../activity/activity.service'
import { DomainError, isUniqueViolation } from '../errors'
import { nextCompletedAt } from '../issues/completed-at'
import { CLOSED_STATUS_CATEGORIES, relationRoles, type IssueRelationType } from './roles'

export type CreateRelationInput = {
  workspaceId: string
  issueId: string
  relatedIssueId: string
  type: IssueRelationType
  actorId: string
}

export type RelationRecord = typeof issueRelations.$inferSelect

const RELATION_CONSTRAINTS = [
  'issue_relations_issue_id_related_issue_id_type_unique',
  'issue_relations_pair_type_unique',
]

/**
 * Relates two issues of the workspace. Marking a duplicate also cancels the
 * duplicate (docs/domain.md → Relations); `statusChanged` tells the caller.
 */
export async function createRelation(db: DbOrTx, input: CreateRelationInput) {
  if (input.issueId === input.relatedIssueId) {
    throw new DomainError('BAD_REQUEST', 'An issue cannot be related to itself')
  }
  try {
    return await db.transaction(async (tx) => {
      const pair = await lockIssues(tx, input.workspaceId, [input.issueId, input.relatedIssueId])
      const source = pair.find((row) => row.id === input.issueId)
      const target = pair.find((row) => row.id === input.relatedIssueId)
      if (!source || !target) throw new DomainError('NOT_FOUND', 'Issue not found')

      const [relation] = await tx
        .insert(issueRelations)
        .values({
          workspaceId: input.workspaceId,
          issueId: source.id,
          relatedIssueId: target.id,
          type: input.type,
          createdById: input.actorId,
        })
        .returning()
      if (!relation) throw new Error('relation insert returned no row')

      const actor = { type: 'user', id: input.actorId } as const
      const roles = relationRoles(input.type)
      await recordActivity(tx, {
        workspaceId: input.workspaceId,
        issueId: source.id,
        actor,
        changes: [
          { kind: 'relation', from: null, to: [roles.source, target.id, target.identifier] },
        ],
      })
      await recordActivity(tx, {
        workspaceId: input.workspaceId,
        issueId: target.id,
        actor,
        changes: [
          { kind: 'relation', from: null, to: [roles.target, source.id, source.identifier] },
        ],
      })

      const statusChanged =
        input.type === 'duplicate' && (await cancelDuplicate(tx, input.workspaceId, source, actor))
      return { relation, statusChanged }
    })
  } catch (error) {
    if (RELATION_CONSTRAINTS.some((name) => isUniqueViolation(error, name))) {
      throw new DomainError('CONFLICT', 'These issues are already related this way')
    }
    throw error
  }
}

/** Removes a relation and records it on both issues. */
export async function deleteRelation(
  db: DbOrTx,
  input: { workspaceId: string; id: string; actorId: string },
) {
  return db.transaction(async (tx) => {
    const [relation] = await tx
      .delete(issueRelations)
      .where(
        and(eq(issueRelations.workspaceId, input.workspaceId), eq(issueRelations.id, input.id)),
      )
      .returning()
    if (!relation) throw new DomainError('NOT_FOUND', 'Relation not found')

    const pair = await lockIssues(tx, input.workspaceId, [
      relation.issueId,
      relation.relatedIssueId,
    ])
    const source = pair.find((row) => row.id === relation.issueId)
    const target = pair.find((row) => row.id === relation.relatedIssueId)
    const roles = relationRoles(relation.type)
    const actor = { type: 'user', id: input.actorId } as const
    if (source && target) {
      await recordActivity(tx, {
        workspaceId: input.workspaceId,
        issueId: source.id,
        actor,
        changes: [
          { kind: 'relation', from: [roles.source, target.id, target.identifier], to: null },
        ],
      })
      await recordActivity(tx, {
        workspaceId: input.workspaceId,
        issueId: target.id,
        actor,
        changes: [
          { kind: 'relation', from: [roles.target, source.id, source.identifier], to: null },
        ],
      })
    }
    return relation
  })
}

/** Both directions of every relation of the issue, grouped as read from its side. */
export async function getIssueRelations(db: DbOrTx, workspaceId: string, issueId: string) {
  const other = aliasedTable(issues, 'other_issue')
  const select = (own: 'issueId' | 'relatedIssueId') => {
    const otherSide = own === 'issueId' ? issueRelations.relatedIssueId : issueRelations.issueId
    return db
      .select({
        relationId: issueRelations.id,
        type: issueRelations.type,
        id: other.id,
        number: other.number,
        title: other.title,
        teamKey: teams.key,
        status: workflowStatuses,
      })
      .from(issueRelations)
      .innerJoin(other, eq(other.id, otherSide))
      .innerJoin(teams, eq(teams.id, other.teamId))
      .innerJoin(workflowStatuses, eq(workflowStatuses.id, other.statusId))
      .where(and(eq(issueRelations.workspaceId, workspaceId), eq(issueRelations[own], issueId)))
      .orderBy(asc(issueRelations.id))
  }
  const [outgoing, incoming] = await Promise.all([select('issueId'), select('relatedIssueId')])
  const toRelated = (row: (typeof outgoing)[number]) => ({
    relationId: row.relationId,
    id: row.id,
    identifier: `${row.teamKey}-${row.number}`,
    title: row.title,
    status: row.status,
  })
  const of = (rows: typeof outgoing, type: IssueRelationType) =>
    rows.filter((row) => row.type === type).map(toRelated)
  return {
    blocks: of(outgoing, 'blocks'),
    blockedBy: of(incoming, 'blocks'),
    related: [...of(outgoing, 'related'), ...of(incoming, 'related')].sort((a, b) =>
      a.relationId.localeCompare(b.relationId),
    ),
    duplicateOf: of(outgoing, 'duplicate'),
    duplicates: of(incoming, 'duplicate'),
  }
}

export type IssueRelationsRecord = Awaited<ReturnType<typeof getIssueRelations>>

/** Locks the issues (in id order, so concurrent writers can't deadlock) with their identifiers. */
async function lockIssues(tx: DbOrTx, workspaceId: string, ids: string[]) {
  const rows = await tx
    .select({
      id: issues.id,
      teamId: issues.teamId,
      number: issues.number,
      completedAt: issues.completedAt,
      statusId: issues.statusId,
      teamKey: teams.key,
      category: workflowStatuses.category,
    })
    .from(issues)
    .innerJoin(teams, eq(teams.id, issues.teamId))
    .innerJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
    .where(and(eq(issues.workspaceId, workspaceId), inArray(issues.id, ids)))
    .orderBy(asc(issues.id))
    .for('update', { of: issues })
  return rows.map((row) => ({ ...row, identifier: `${row.teamKey}-${row.number}` }))
}

type LockedIssue = Awaited<ReturnType<typeof lockIssues>>[number]

/**
 * Moves a newly marked duplicate to its team's first canceled status. Issues that
 * are already completed or canceled keep their status, as does a team without one.
 */
async function cancelDuplicate(
  tx: DbOrTx,
  workspaceId: string,
  issue: LockedIssue,
  actor: { type: 'user'; id: string },
) {
  if ((CLOSED_STATUS_CATEGORIES as readonly string[]).includes(issue.category)) return false
  const [canceled] = await tx
    .select({ id: workflowStatuses.id })
    .from(workflowStatuses)
    .where(
      and(
        eq(workflowStatuses.workspaceId, workspaceId),
        eq(workflowStatuses.teamId, issue.teamId),
        eq(workflowStatuses.category, 'canceled'),
      ),
    )
    .orderBy(asc(workflowStatuses.position))
    .limit(1)
  if (!canceled) return false
  await tx
    .update(issues)
    .set({
      statusId: canceled.id,
      completedAt: nextCompletedAt('canceled', issue.completedAt),
      updatedAt: new Date(),
    })
    .where(eq(issues.id, issue.id))
  await recordActivity(tx, {
    workspaceId,
    issueId: issue.id,
    actor,
    changes: [{ kind: 'status', from: issue.statusId, to: canceled.id }],
  })
  return true
}
