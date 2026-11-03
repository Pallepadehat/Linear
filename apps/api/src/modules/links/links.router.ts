import {
  createIssueLink,
  createProjectLink,
  deleteIssueLink,
  deleteProjectLink,
  listProjectLinks,
  updateIssueLink,
  updateProjectLink,
} from '@linear/core'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { publishChange } from '../realtime/publish'
import { toIssueLinkDto, toProjectLinkDto } from './links.dto'

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

// A project's Resources; any member may manage them, like project properties.
export const projectLinksRouter = {
  list: authed.projectLinks.list
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      (await listProjectLinks(context.db, context.workspace.id, input.projectId)).map(
        toProjectLinkDto,
      ),
    ),

  create: authed.projectLinks.create
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const link = await createProjectLink(context.db, {
        workspaceId: context.workspace.id,
        projectId: input.projectId,
        url: input.url,
        title: input.title,
        actorId: context.user.id,
      })
      await publishChange(context, { type: 'project.updated', projectId: link.projectId })
      return toProjectLinkDto(link)
    }),

  update: authed.projectLinks.update
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const link = await updateProjectLink(context.db, {
        workspaceId: context.workspace.id,
        id: input.id,
        url: input.url,
        title: input.title,
      })
      await publishChange(context, { type: 'project.updated', projectId: link.projectId })
      return toProjectLinkDto(link)
    }),

  delete: authed.projectLinks.delete
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const link = await deleteProjectLink(context.db, {
        workspaceId: context.workspace.id,
        id: input.id,
      })
      await publishChange(context, { type: 'project.updated', projectId: link.projectId })
      return { id: link.id }
    }),
}
