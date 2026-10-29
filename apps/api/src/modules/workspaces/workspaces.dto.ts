import type { Workspace } from '@linear/contract'
import type { workspaces } from '@linear/db'

export function toWorkspaceDto(
  row: typeof workspaces.$inferSelect,
  role: Workspace['role'],
): Workspace {
  return { id: row.id, name: row.name, slug: row.slug, role }
}
