import type { IssueLink, ProjectLink } from '@linear/contract'
import type { IssueLinkRecord, ProjectLinkRecord } from '@linear/core'

type LinkRecord = Pick<IssueLinkRecord, 'id' | 'url' | 'title' | 'hostname' | 'createdAt'>

export function toIssueLinkDto(record: LinkRecord): IssueLink {
  return {
    id: record.id,
    url: record.url,
    title: record.title,
    hostname: record.hostname,
    createdAt: record.createdAt,
  }
}

export function toProjectLinkDto(record: ProjectLinkRecord): ProjectLink {
  return { ...toIssueLinkDto(record), projectId: record.projectId }
}
