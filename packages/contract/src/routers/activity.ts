import { oc } from '@orpc/contract'
import { activityPageSchema, listActivityInputSchema } from '../schemas/activity'

export const activityContract = {
  // Unbounded, so cursor-paginated (see AGENTS.md → API).
  list: oc.input(listActivityInputSchema).output(activityPageSchema),
}
