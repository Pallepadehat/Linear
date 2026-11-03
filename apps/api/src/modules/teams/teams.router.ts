import {
  createTeam,
  getTeamByKey,
  listTeams,
  listWorkflowStatuses,
  updateTeamDefaults,
} from '@linear/core'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { toTeamWithStatusesDto } from './teams.dto'

const inWorkspace = requireWorkspace()

export const teamsRouter = {
  // Any member may create teams (docs/domain.md → Roles).
  create: authed.teams.create
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const team = await createTeam(context.db, {
        workspaceId: context.workspace.id,
        creatorId: context.user.id,
        name: input.name,
        key: input.key,
      })
      const statuses = await listWorkflowStatuses(context.db, context.workspace.id, [team.id])
      return toTeamWithStatusesDto(team, statuses)
    }),

  get: authed.teams.get
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const team = await getTeamByKey(context.db, context.workspace.id, input.key)
      const statuses = await listWorkflowStatuses(context.db, context.workspace.id, [team.id])
      return toTeamWithStatusesDto(team, statuses)
    }),

  list: authed.teams.list
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context }) => {
      const teams = await listTeams(context.db, context.workspace.id)
      const statuses = await listWorkflowStatuses(
        context.db,
        context.workspace.id,
        teams.map((team) => team.id),
      )
      return teams.map((team) => toTeamWithStatusesDto(team, statuses))
    }),

  // Issue defaults are team settings, so owner-only (docs/domain.md → Roles).
  update: authed.teams.update
    .use(requireWorkspace('owner'), (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const current = await getTeamByKey(context.db, context.workspace.id, input.key)
      const team = await updateTeamDefaults(context.db, {
        workspaceId: context.workspace.id,
        teamId: current.id,
        defaultStatusId: input.defaultStatusId,
        defaultPriority: input.defaultPriority,
        defaultAssigneeId: input.defaultAssigneeId,
      })
      const statuses = await listWorkflowStatuses(context.db, context.workspace.id, [team.id])
      return toTeamWithStatusesDto(team, statuses)
    }),
}
