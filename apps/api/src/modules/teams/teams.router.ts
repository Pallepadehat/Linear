import {
  createTeam,
  getTeamByKey,
  listTeams,
  listWorkflowStatuses,
  updateTeamCycleSettings,
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

  // Issue defaults, estimates and cycle settings are team settings, so owner-only (docs/domain.md → Roles).
  update: authed.teams.update
    .use(requireWorkspace('owner'), (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const current = await getTeamByKey(context.db, context.workspace.id, input.key)
      const {
        workspaceSlug: _,
        key: __,
        defaultStatusId,
        defaultPriority,
        defaultAssigneeId,
        estimateScale,
        estimateAllowZero,
        ...cycleSettings
      } = input
      let team = await updateTeamDefaults(context.db, {
        workspaceId: context.workspace.id,
        teamId: current.id,
        defaultStatusId,
        defaultPriority,
        defaultAssigneeId,
        estimateScale,
        estimateAllowZero,
      })
      if (Object.values(cycleSettings).some((value) => value !== undefined)) {
        team = await updateTeamCycleSettings(context.db, {
          ...cycleSettings,
          workspaceId: context.workspace.id,
          teamId: current.id,
        })
      }
      const statuses = await listWorkflowStatuses(context.db, context.workspace.id, [team.id])
      return toTeamWithStatusesDto(team, statuses)
    }),
}
