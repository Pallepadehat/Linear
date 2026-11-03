import { oc } from '@orpc/contract'
import { z } from 'zod'
import { workspaceScopedSchema } from '../schemas/common'
import {
  createTeamInputSchema,
  getTeamInputSchema,
  teamWithStatusesSchema,
  updateTeamInputSchema,
} from '../schemas/teams'

export const teamsContract = {
  create: oc.input(createTeamInputSchema).output(teamWithStatusesSchema),
  get: oc.input(getTeamInputSchema).output(teamWithStatusesSchema),
  // Statuses included so cross-team views can offer status filters.
  list: oc.input(workspaceScopedSchema).output(z.array(teamWithStatusesSchema)),
  update: oc.input(updateTeamInputSchema).output(teamWithStatusesSchema),
}
