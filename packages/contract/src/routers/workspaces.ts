import { oc } from '@orpc/contract'
import { z } from 'zod'
import {
  createWorkspaceInputSchema,
  createWorkspaceOutputSchema,
  getWorkspaceInputSchema,
  memberSchema,
  workspaceSchema,
} from '../schemas/workspaces'

export const workspacesContract = {
  create: oc.input(createWorkspaceInputSchema).output(createWorkspaceOutputSchema),
  get: oc.input(getWorkspaceInputSchema).output(workspaceSchema),
  listMembers: oc.input(getWorkspaceInputSchema).output(z.array(memberSchema)),
}
