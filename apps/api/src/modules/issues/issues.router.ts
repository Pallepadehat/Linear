import {
  createIssue,
  deleteIssue,
  getIssue,
  getIssueByIdentifier,
  listIssues,
  updateIssue,
} from '@linear/core'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { toIssueDto } from './issues.dto'

const inWorkspace = requireWorkspace()

// Any member may create, edit and delete issues (docs/domain.md → Roles).
export const issuesRouter = {
  create: authed.issues.create
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const { workspaceSlug: _, ...fields } = input
      const issue = await createIssue(context.db, {
        ...fields,
        workspaceId: context.workspace.id,
        creatorId: context.user.id,
      })
      return toIssueDto(await getIssue(context.db, context.workspace.id, issue.id))
    }),

  get: authed.issues.get
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      toIssueDto(await getIssue(context.db, context.workspace.id, input.id)),
    ),

  getByIdentifier: authed.issues.getByIdentifier
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const { teamKey, number } = input.identifier
      return toIssueDto(
        await getIssueByIdentifier(context.db, context.workspace.id, teamKey, number),
      )
    }),

  update: authed.issues.update
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const { workspaceSlug: _, ...fields } = input
      const issue = await updateIssue(context.db, {
        ...fields,
        workspaceId: context.workspace.id,
        actor: { type: 'user', id: context.user.id },
      })
      return toIssueDto(issue)
    }),

  delete: authed.issues.delete
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => deleteIssue(context.db, context.workspace.id, input.id)),

  list: authed.issues.list
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const page = await listIssues(context.db, {
        workspaceId: context.workspace.id,
        teamId: input.teamId,
        projectId: input.projectId,
        cursor: input.cursor,
        limit: input.limit,
      })
      return { items: page.items.map(toIssueDto), nextCursor: page.nextCursor }
    }),
}
