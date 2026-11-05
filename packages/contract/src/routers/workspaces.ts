import { oc } from '@orpc/contract'
import { z } from 'zod'
import {
  createWorkspaceInputSchema,
  createWorkspaceOutputSchema,
  getWorkspaceInputSchema,
  joinWorkspaceInputSchema,
  memberSchema,
  workspaceInviteSchema,
  workspaceSchema,
} from '../schemas/workspaces'

export const workspacesContract = {
  create: oc.input(createWorkspaceInputSchema).output(createWorkspaceOutputSchema),
  get: oc.input(getWorkspaceInputSchema).output(workspaceSchema),
  listMembers: oc.input(getWorkspaceInputSchema).output(z.array(memberSchema)),
  /** Joins the workspace whose invite code this is, as a member. Already a member: no-op. */
  join: oc.input(joinWorkspaceInputSchema).output(workspaceSchema),
  // Owner-only: read, (re)generate, or turn off the workspace's invite code.
  getInvite: oc.input(getWorkspaceInputSchema).output(workspaceInviteSchema),
  resetInvite: oc.input(getWorkspaceInputSchema).output(workspaceInviteSchema),
  disableInvite: oc.input(getWorkspaceInputSchema).output(workspaceInviteSchema),
}
