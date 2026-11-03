import {
  parseStoredViewDisplay,
  parseStoredViewFilters,
  viewColorSchema,
  viewIconSchema,
  type View,
} from '@linear/contract'
import type { ViewRecord } from '@linear/core'
import type { DbOrTx } from '@linear/db'
import type { Storage } from '@linear/storage'
import { imageUrl } from '../../lib/upload-urls'

/** Stored JSON is re-parsed with the contract's schemas, so stale fields are dropped. */
export async function toViewDto(db: DbOrTx, storage: Storage, row: ViewRecord): Promise<View> {
  return {
    id: row.id,
    teamId: row.teamId,
    scope: row.teamId ? 'team' : 'workspace',
    name: row.name,
    icon: viewIconSchema.catch('layers').parse(row.icon),
    color: viewColorSchema.catch('neutral').parse(row.color),
    filters: parseStoredViewFilters(row.filters),
    display: parseStoredViewDisplay(row.display),
    shared: row.shared,
    owner: {
      id: row.owner.id,
      name: row.owner.name,
      avatarUrl: await imageUrl(db, storage, row.owner.avatarUploadId),
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
