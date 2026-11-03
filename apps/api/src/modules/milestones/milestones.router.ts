import type { Milestone } from '@linear/contract'
import {
  createMilestone,
  deleteMilestone,
  listMilestones,
  reorderMilestones,
  updateMilestone,
  type MilestoneRecord,
} from '@linear/core'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { publishChange } from '../realtime/publish'

const inWorkspace = requireWorkspace()

function toMilestoneDto(row: MilestoneRecord): Milestone {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    targetDate: row.targetDate,
    sortOrder: row.sortOrder,
    issueCount: row.issueCount,
    doneCount: row.doneCount,
    progress: row.progress,
    isComplete: row.isComplete,
    createdAt: row.createdAt,
  }
}

// Any member may manage milestones, like the project itself (docs/domain.md → Roles).
// Every change is a change to the project, so it publishes `project.updated`.
export const milestonesRouter = {
  list: authed.milestones.list
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      (await listMilestones(context.db, context.workspace.id, input.projectId)).map(toMilestoneDto),
    ),
  create: authed.milestones.create
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const { workspaceSlug: _, ...fields } = input
      const milestone = await createMilestone(context.db, context.workspace.id, fields)
      await publishChange(context, { type: 'project.updated', projectId: milestone.projectId })
      return toMilestoneDto(milestone)
    }),
  update: authed.milestones.update
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const { workspaceSlug: _, id, ...fields } = input
      const milestone = await updateMilestone(context.db, context.workspace.id, id, fields)
      await publishChange(context, { type: 'project.updated', projectId: milestone.projectId })
      return toMilestoneDto(milestone)
    }),
  delete: authed.milestones.delete
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const deleted = await deleteMilestone(context.db, context.workspace.id, input.id)
      await publishChange(context, { type: 'project.updated', projectId: deleted.projectId })
      // Its issues stay in the project without a milestone.
      for (const issueId of deleted.issueIds) {
        await publishChange(context, { type: 'issue.updated', issueId, fields: ['milestone'] })
      }
      return { id: deleted.id }
    }),
  reorder: authed.milestones.reorder
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const list = await reorderMilestones(
        context.db,
        context.workspace.id,
        input.projectId,
        input.orderedIds,
      )
      await publishChange(context, { type: 'project.updated', projectId: input.projectId })
      return list.map(toMilestoneDto)
    }),
}
