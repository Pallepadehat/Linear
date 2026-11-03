import { orpc } from '@/lib/orpc'

/** Workspace templates, plus the team's when `teamId` is given. */
export const templateListOptions = (workspaceSlug: string, teamId?: string) =>
  orpc.templates.list.queryOptions({ input: { workspaceSlug, teamId } })

/** Matches every template list, for invalidation (mutations and realtime). */
export const templatesKey = () => orpc.templates.key()
