import { z } from 'zod'
import { workspaceScopedSchema } from './common'
import { statusCategorySchema } from './teams'
import { viewColorSchema, viewIconSchema } from './views'

export const favoriteEntityTypeSchema = z.enum(['issue', 'project', 'view', 'team'])

const base = { id: z.uuid(), entityId: z.uuid() }

/** One sidebar favorite with the display summary the server resolved for it. */
export const favoriteSchema = z.discriminatedUnion('entityType', [
  z.object({
    ...base,
    entityType: z.literal('issue'),
    identifier: z.string(),
    title: z.string(),
    statusCategory: statusCategorySchema,
  }),
  z.object({
    ...base,
    entityType: z.literal('project'),
    name: z.string(),
    /** Short-lived presigned URL for the project icon, or null. */
    iconUrl: z.url().nullable(),
  }),
  z.object({
    ...base,
    entityType: z.literal('team'),
    name: z.string(),
    key: z.string(),
  }),
  z.object({
    ...base,
    entityType: z.literal('view'),
    name: z.string(),
    icon: viewIconSchema,
    color: viewColorSchema,
  }),
])

export const addFavoriteInputSchema = workspaceScopedSchema.extend({
  entityType: favoriteEntityTypeSchema,
  entityId: z.uuid(),
})

export const favoriteIdInputSchema = workspaceScopedSchema.extend({ id: z.uuid() })

/** The new order, first to last; favorites left out keep their order after these. */
export const reorderFavoritesInputSchema = workspaceScopedSchema.extend({
  ids: z.array(z.uuid()).min(1).max(500),
})

export type FavoriteEntityType = z.infer<typeof favoriteEntityTypeSchema>
export type Favorite = z.infer<typeof favoriteSchema>
export type AddFavoriteInput = z.infer<typeof addFavoriteInputSchema>
