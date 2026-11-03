import type { ProjectUpdate } from '@linear/contract'

type Viewer = { userId: string | undefined; role: 'owner' | 'member' | undefined }

/**
 * What one update renders, flattened so components don't take zod-inferred props. Edit
 * is the author's; delete is the author's or a workspace owner's (docs/domain.md →
 * Project updates). The server enforces both; this only hides what would fail.
 */
export function projectUpdateRow(update: ProjectUpdate, viewer: Viewer) {
  const isAuthor = viewer.userId !== undefined && update.author.id === viewer.userId
  return {
    id: update.id,
    authorName: update.author.name,
    authorAvatarUrl: update.author.avatarUrl,
    health: update.health,
    body: update.body,
    createdAt: update.createdAt,
    updatedAt: update.updatedAt,
    canEdit: isAuthor,
    canDelete: isAuthor || viewer.role === 'owner',
  }
}
