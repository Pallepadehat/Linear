import { oc } from '@orpc/contract'
import { z } from 'zod'
import { userSchema } from '../schemas/users'
import {
  createIssueInputSchema,
  getIssueByIdentifierInputSchema,
  issueDetailSchema,
  issueIdInputSchema,
  issuePageSchema,
  issueSchema,
  issueSubscribersInputSchema,
  issueSubscriptionInputSchema,
  issueSubscriptionSchema,
  listIssuesInputSchema,
  updateIssueInputSchema,
} from '../schemas/issues'

export const issuesContract = {
  create: oc.input(createIssueInputSchema).output(issueSchema),
  get: oc.input(issueIdInputSchema).output(issueDetailSchema),
  getByIdentifier: oc.input(getIssueByIdentifierInputSchema).output(issueDetailSchema),
  update: oc.input(updateIssueInputSchema).output(issueSchema),
  delete: oc.input(issueIdInputSchema).output(z.object({ id: z.uuid() })),
  // Unbounded, so cursor-paginated (see AGENTS.md → API).
  list: oc.input(listIssuesInputSchema).output(issuePageSchema),
  subscribe: oc.input(issueSubscriptionInputSchema).output(issueSubscriptionSchema),
  unsubscribe: oc.input(issueSubscriptionInputSchema).output(issueSubscriptionSchema),
  // Bounded by the workspace's members, so a plain array.
  subscribers: oc.input(issueSubscribersInputSchema).output(z.array(userSchema)),
}
