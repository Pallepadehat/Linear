import type { StatusCategory } from '@linear/db'

export type { StatusCategory } from '@linear/db'
export type LinkType = 'closing' | 'reference'
export type PRState = 'open' | 'draft' | 'closed' | 'merged'

export type AutomationEvent =
  | { type: 'link_created'; linkType: LinkType; prState: PRState }
  | { type: 'pr_merged' | 'pr_closed'; linkType: LinkType }

export function evaluate(
  issue: { category: StatusCategory },
  links: ReadonlyArray<{ type: LinkType; prState: PRState }>,
  event: AutomationEvent,
): { to: 'started' | 'completed' } | null {
  if (issue.category === 'completed' || issue.category === 'canceled') return null
  if (event.linkType === 'reference') return null

  if (event.type === 'link_created') {
    if (
      (event.prState === 'open' || event.prState === 'draft') &&
      (issue.category === 'backlog' || issue.category === 'unstarted')
    ) {
      return { to: 'started' }
    }
    return null
  }

  if (event.type === 'pr_merged') {
    const required = links.filter((link) => link.type === 'closing' && link.prState !== 'closed')
    if (required.length > 0 && required.every((link) => link.prState === 'merged')) {
      return { to: 'completed' }
    }
  }

  return null
}
