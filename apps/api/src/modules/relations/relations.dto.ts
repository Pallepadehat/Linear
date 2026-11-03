import type { IssueRelation, IssueRelations } from '@linear/contract'
import type { IssueRelationsRecord, RelationRecord } from '@linear/core'

export function toIssueRelationDto(record: RelationRecord): IssueRelation {
  return {
    id: record.id,
    issueId: record.issueId,
    relatedIssueId: record.relatedIssueId,
    type: record.type,
  }
}

export function toIssueRelationsDto(record: IssueRelationsRecord): IssueRelations {
  const side = (rows: IssueRelationsRecord['blocks']) =>
    rows.map((row) => ({
      relationId: row.relationId,
      id: row.id,
      identifier: row.identifier,
      title: row.title,
      status: {
        id: row.status.id,
        name: row.status.name,
        category: row.status.category,
        position: row.status.position,
      },
    }))
  return {
    blocks: side(record.blocks),
    blockedBy: side(record.blockedBy),
    related: side(record.related),
    duplicateOf: side(record.duplicateOf),
    duplicates: side(record.duplicates),
  }
}
