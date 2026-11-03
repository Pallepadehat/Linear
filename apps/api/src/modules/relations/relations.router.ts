import { createRelation, deleteRelation } from '@linear/core'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { publishChange } from '../realtime/publish'
import { toIssueRelationDto } from './relations.dto'

const inWorkspace = requireWorkspace()

// Any member may relate issues (docs/domain.md → Roles, Relations).
export const issueRelationsRouter = {
  create: authed.issueRelations.create
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const { relation, statusChanged } = await createRelation(context.db, {
        workspaceId: context.workspace.id,
        issueId: input.issueId,
        relatedIssueId: input.relatedIssueId,
        type: input.type,
        actorId: context.user.id,
      })
      await publishChange(context, {
        type: 'issue.updated',
        issueId: relation.issueId,
        fields: statusChanged ? ['relations', 'status'] : ['relations'],
      })
      await publishChange(context, {
        type: 'issue.updated',
        issueId: relation.relatedIssueId,
        fields: ['relations'],
      })
      return toIssueRelationDto(relation)
    }),

  delete: authed.issueRelations.delete
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const relation = await deleteRelation(context.db, {
        workspaceId: context.workspace.id,
        id: input.id,
        actorId: context.user.id,
      })
      for (const issueId of [relation.issueId, relation.relatedIssueId]) {
        await publishChange(context, { type: 'issue.updated', issueId, fields: ['relations'] })
      }
      return { id: relation.id }
    }),
}
