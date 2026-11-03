import {
  createIssue,
  deleteIssue,
  getIssue,
  getIssueByIdentifier,
  listIssues,
  listSubscribers,
  subscribe,
  unsubscribe,
  updateIssue,
} from '@linear/core'
import { enqueue } from '@linear/queue'
import { imageUrl } from '../../lib/upload-urls'
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
      return toIssueDto(await getIssue(context.db, context.workspace.id, issue.id, context.user.id))
    }),

  get: authed.issues.get
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      toIssueDto(await getIssue(context.db, context.workspace.id, input.id, context.user.id)),
    ),

  getByIdentifier: authed.issues.getByIdentifier
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const { teamKey, number } = input.identifier
      return toIssueDto(
        await getIssueByIdentifier(
          context.db,
          context.workspace.id,
          teamKey,
          number,
          context.user.id,
        ),
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
      const { workspaceSlug: _, assignee, creator, subscriberIds, ...query } = input
      const page = await listIssues(context.db, {
        ...query,
        workspaceId: context.workspace.id,
        viewerId: context.user.id,
        subscriberIds: subscriberIds?.map((id) => (id === 'me' ? context.user.id : id)),
        assigneeId: assignee === 'me' ? context.user.id : undefined,
        creatorId: creator === 'me' ? context.user.id : undefined,
      })
      return { items: page.items.map(toIssueDto), nextCursor: page.nextCursor }
    }),

  subscribe: authed.issues.subscribe
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const result = await subscribe(context.db, {
        workspaceId: context.workspace.id,
        issueId: input.issueId,
        userId: input.userId ?? context.user.id,
      })
      await publishChange(context, {
        type: 'issue.updated',
        issueId: input.issueId,
        fields: ['subscribers'],
      })
      return result
    }),

  unsubscribe: authed.issues.unsubscribe
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const result = await unsubscribe(context.db, {
        workspaceId: context.workspace.id,
        issueId: input.issueId,
        userId: input.userId ?? context.user.id,
      })
      await publishChange(context, {
        type: 'issue.updated',
        issueId: input.issueId,
        fields: ['subscribers'],
      })
      return result
    }),

  subscribers: authed.issues.subscribers
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const subscribers = await listSubscribers(context.db, context.workspace.id, input.issueId)
      return Promise.all(
        subscribers.map(async (s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          avatarUrl: await imageUrl(context.db, context.storage, s.avatarUploadId),
        })),
      )
    }),
}
