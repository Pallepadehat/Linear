import { oc } from '@orpc/contract'
import { z } from 'zod'
import { workspaceScopedSchema } from '../schemas/common'
import {
  createTeamInputSchema,
  getTeamInputSchema,
  teamSchema,
  teamWithStatusesSchema,
  updateTeamInputSchema,
} from '../schemas/teams'

export const teamsContract = {
  create: oc.input(createTeamInputSchema).output(teamWithStatusesSchema),
  get: oc.input(getTeamInputSchema).output(teamWithStatusesSchema),
  list: oc.input(workspaceScopedSchema).output(z.array(teamSchema)),
  update: oc.input(updateTeamInputSchema).output(teamWithStatusesSchema),
}
