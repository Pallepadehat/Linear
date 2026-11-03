import type { LinkedPullRequest, PullRequestLinkType, PullRequestState } from '@linear/contract'

/** Badge text and icon color per state (docs/design.md → Pull requests). */
export const pullRequestStates: Record<PullRequestState, { label: string; iconClass: string }> = {
  open: { label: 'Open', iconClass: 'text-status-started' },
  draft: { label: 'Draft', iconClass: 'text-status-neutral' },
  merged: { label: 'Merged', iconClass: 'text-status-completed' },
  closed: { label: 'Closed', iconClass: 'text-priority-urgent' },
}

export const linkTypeLabel: Record<PullRequestLinkType, string> = {
  closing: 'Closes',
  reference: 'References',
}

/** `tip/app#42`, how GitHub writes a cross-repo PR reference. */
export const pullRequestRef = (pr: Pick<LinkedPullRequest, 'repoFullName' | 'number'>) =>
  `${pr.repoFullName}#${pr.number}`
