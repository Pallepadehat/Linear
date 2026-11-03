import {
  createIssue,
  deleteIssue,
  getIssue,
  getIssueByIdentifier,
  getIssueRelations,
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
import { toIssueDetailDto, toIssueDto } from './issues.dto'

const inWorkspace = requireWorkspace()

async function publishSubIssuesChanged(
  context: Parameters<typeof publishChange>[0],
  parentIds: (string | null)[],
) {
  for (const issueId of new Set(parentIds)) {
    if (issueId)
      await publishChange(context, { type: 'issue.updated', issueId, fields: ['subIssues'] })
  }
}

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
      if (issue.parentId) await publishSubIssuesChanged(context, [issue.parentId])
      return toIssueDto(await getIssue(context.db, context.workspace.id, issue.id, context.user.id))
    }),

  get: authed.issues.get
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const issue = await getIssue(context.db, context.workspace.id, input.id, context.user.id)
      return toIssueDetailDto(
        issue,
        await getIssueRelations(context.db, context.workspace.id, issue.id),
      )
    }),

  getByIdentifier: authed.issues.getByIdentifier
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const { teamKey, number } = input.identifier
      const issue = await getIssueByIdentifier(
        context.db,
        context.workspace.id,
        teamKey,
        number,
        context.user.id,
      )
      return toIssueDetailDto(
        issue,
        await getIssueRelations(context.db, context.workspace.id, issue.id),
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
      // Parents show their sub-issues' progress: tell the old and new parent, and the
      // current one when a sub-issue's status changed.
      const parents = issue.parentChange
        ? [issue.parentChange.from, issue.parentChange.to]
        : fields.statusId !== undefined
          ? [issue.parentId]
          : []
      await publishSubIssuesChanged(context, parents)
      return toIssueDto(issue)
    }),

  delete: authed.issues.delete
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const { id, parentId, childIds, deletedUploadIds } = await deleteIssue(
        context.db,
        context.workspace.id,
        input.id,
      )
      for (const uploadId of deletedUploadIds) {
        await enqueue(context.queues, 'maintenance', 'delete-objects', { uploadId })
      }
      await publishChange(context, { type: 'issue.deleted', issueId: id })
      await publishSubIssuesChanged(context, [parentId])
      // Its sub-issues are top-level issues now.
      for (const childId of childIds) {
        await publishChange(context, {
          type: 'issue.updated',
          issueId: childId,
          fields: ['parent'],
        })
      }
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
