import type { Favorite } from '@linear/contract'
import {
  addFavorite,
  listFavorites,
  removeFavorite,
  reorderFavorites,
  type FavoriteWithSummary,
} from '@linear/core'
import type { DbOrTx } from '@linear/db'
import type { Storage } from '@linear/storage'
import { imageUrl } from '../../lib/upload-urls'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'

const inWorkspace = requireWorkspace()

async function toDto(db: DbOrTx, storage: Storage, row: FavoriteWithSummary): Promise<Favorite> {
  const base = { id: row.id, entityId: row.entityId }
  const { summary } = row
  switch (summary.entityType) {
    case 'issue':
      return {
        ...base,
        entityType: 'issue',
        identifier: summary.identifier,
        title: summary.title,
        statusCategory: summary.statusCategory,
      }
    case 'project':
      return {
        ...base,
        entityType: 'project',
        name: summary.name,
        iconUrl: await imageUrl(db, storage, summary.iconUploadId),
      }
    case 'team':
      return { ...base, entityType: 'team', name: summary.name, key: summary.key }
  }
}

// Favorites are personal: every call is scoped to the signed-in user in this workspace.
export const favoritesRouter = {
  list: authed.favorites.list
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context }) => {
      const rows = await listFavorites(context.db, {
        workspaceId: context.workspace.id,
        userId: context.user.id,
      })
      return Promise.all(rows.map((row) => toDto(context.db, context.storage, row)))
    }),

  add: authed.favorites.add
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const row = await addFavorite(
        context.db,
        { workspaceId: context.workspace.id, userId: context.user.id },
        { entityType: input.entityType, entityId: input.entityId },
      )
      return { id: row.id }
    }),

  remove: authed.favorites.remove
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) =>
      removeFavorite(
        context.db,
        { workspaceId: context.workspace.id, userId: context.user.id },
        input.id,
      ),
    ),

  reorder: authed.favorites.reorder
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      await reorderFavorites(
        context.db,
        { workspaceId: context.workspace.id, userId: context.user.id },
        input.ids,
      )
      return { ok: true as const }
    }),
}
