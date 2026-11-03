import { createIssueLink, deleteIssueLink, updateIssueLink } from '@linear/core'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { publishChange } from '../realtime/publish'
import { toIssueLinkDto } from './links.dto'

const inWorkspace = requireWorkspace()

// Any member may add, edit and remove links (docs/domain.md → Roles, Links).
export const issueLinksRouter = {
  create: authed.issueLinks.create
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const link = await createIssueLink(context.db, {
        workspaceId: context.workspace.id,
        issueId: input.issueId,
        url: input.url,
        title: input.title,
        actorId: context.user.id,
      })
      await publishChange(context, {
        type: 'issue.updated',
        issueId: link.issueId,
        fields: ['links'],
      })
      return toIssueLinkDto(link)
    }),

  update: authed.issueLinks.update
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const link = await updateIssueLink(context.db, {
        workspaceId: context.workspace.id,
        id: input.id,
        url: input.url,
        title: input.title,
      })
      await publishChange(context, {
        type: 'issue.updated',
        issueId: link.issueId,
        fields: ['links'],
      })
      return toIssueLinkDto(link)
    }),

  delete: authed.issueLinks.delete
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const link = await deleteIssueLink(context.db, {
        workspaceId: context.workspace.id,
        id: input.id,
        actorId: context.user.id,
      })
      await publishChange(context, {
        type: 'issue.updated',
        issueId: link.issueId,
        fields: ['links'],
      })
      return { id: link.id }
    }),
}
