import { oc } from '@orpc/contract'
import { z } from 'zod'
import { updateMeInputSchema, userSchema } from '../schemas/users'
import { workspaceSchema } from '../schemas/workspaces'

export const meContract = {
  get: oc.output(userSchema),
  update: oc.input(updateMeInputSchema).output(userSchema),
  // Bounded by membership count, so a plain array (see AGENTS.md → API).
  listWorkspaces: oc.output(z.array(workspaceSchema)),
}
