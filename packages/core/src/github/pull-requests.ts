import {
  githubRepositories,
  issuePullRequestLinks,
  issues,
  pullRequests,
  type DbOrTx,
} from '@linear/db'
import { and, desc, eq } from 'drizzle-orm'
import { DomainError } from '../errors'

/** The PRs linked to an issue, most recently updated first. */
export async function listIssuePullRequests(db: DbOrTx, workspaceId: string, issueId: string) {
  const [issue] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, issueId)))
  if (!issue) throw new DomainError('NOT_FOUND', 'Issue not found')

  return db
    .select({
      id: pullRequests.id,
      number: pullRequests.number,
      title: pullRequests.title,
      url: pullRequests.url,
      repoFullName: githubRepositories.fullName,
      state: pullRequests.state,
      linkType: issuePullRequestLinks.type,
      updatedAt: pullRequests.updatedAt,
    })
    .from(issuePullRequestLinks)
    .innerJoin(pullRequests, eq(pullRequests.id, issuePullRequestLinks.pullRequestId))
    .innerJoin(githubRepositories, eq(githubRepositories.id, pullRequests.repositoryId))
    .where(
      and(
        eq(issuePullRequestLinks.workspaceId, workspaceId),
        eq(issuePullRequestLinks.issueId, issue.id),
        eq(pullRequests.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(pullRequests.updatedAt), desc(pullRequests.id))
}
