import type { IssueLink } from '@linear/contract'
import type { IssueLinkRecord } from '@linear/core'

export function toIssueLinkDto(record: IssueLinkRecord): IssueLink {
  return {
    id: record.id,
    url: record.url,
    title: record.title,
    hostname: record.hostname,
    createdAt: record.createdAt,
  }
}
