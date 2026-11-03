import { oc } from '@orpc/contract'
import { z } from 'zod'
import { workspaceScopedSchema } from '../schemas/common'
import {
  addFavoriteInputSchema,
  favoriteIdInputSchema,
  favoriteSchema,
  reorderFavoritesInputSchema,
} from '../schemas/favorites'

// Personal to the signed-in user; bounded, so list is a plain array (see AGENTS.md → API).
export const favoritesContract = {
  list: oc.input(workspaceScopedSchema).output(z.array(favoriteSchema)),
  /** Idempotent: adding an existing favorite returns it unchanged. */
  add: oc.input(addFavoriteInputSchema).output(z.object({ id: z.uuid() })),
  remove: oc.input(favoriteIdInputSchema).output(z.object({ id: z.uuid() })),
  reorder: oc.input(reorderFavoritesInputSchema).output(z.object({ ok: z.literal(true) })),
}
