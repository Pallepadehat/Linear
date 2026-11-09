import { orpc } from '@/lib/orpc'

export const issuePullRequestsOptions = (workspaceSlug: string, issueId: string) =>
  orpc.github.pullRequests.listForIssue.queryOptions({ input: { workspaceSlug, issueId } })
