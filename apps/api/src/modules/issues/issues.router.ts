import {
  createIssue,
  deleteIssue,
  getIssue,
  getIssueByIdentifier,
  listIssues,
  updateIssue,
} from '@linear/core'
import { enqueue } from '@linear/queue'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { changedIssueFields, publishChange } from '../realtime/publish'
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
      await publishChange(context, { type: 'issue.created', issueId: issue.id })
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
      await publishChange(context, {
        type: 'issue.updated',
        issueId: issue.id,
        fields: changedIssueFields(fields),
      })
      return toIssueDto(issue)
    }),

  delete: authed.issues.delete
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const { id, deletedUploadIds } = await deleteIssue(context.db, context.workspace.id, input.id)
      for (const uploadId of deletedUploadIds) {
        await enqueue(context.queues, 'maintenance', 'delete-objects', { uploadId })
      }
      await publishChange(context, { type: 'issue.deleted', issueId: id })
      return { id }
    }),

  list: authed.issues.list
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const page = await listIssues(context.db, {
        workspaceId: context.workspace.id,
        teamId: input.teamId,
        projectId: input.projectId,
        assigneeId: input.assignee === 'me' ? context.user.id : undefined,
        creatorId: input.creator === 'me' ? context.user.id : undefined,
        cursor: input.cursor,
        limit: input.limit,
      })
      return { items: page.items.map(toIssueDto), nextCursor: page.nextCursor }
    }),
}
