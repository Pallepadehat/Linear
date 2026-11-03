import type { View, WorkspaceRole } from '@linear/contract'

/**
 * Mirrors the server rule (docs/domain.md → Views): a shared view is changed only by its
 * owner or a workspace owner; a private view is only ever seen by its owner.
 */
export function canEditView(
  view: Pick<View, 'shared' | 'owner'>,
  userId: string | undefined,
  role: WorkspaceRole | undefined,
) {
  return !view.shared || view.owner.id === userId || role === 'owner'
}

/** The name a duplicate gets. */
export const copyName = (name: string) => `${name} (copy)`.slice(0, 80)
