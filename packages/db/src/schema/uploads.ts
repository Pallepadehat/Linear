import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { users } from './auth'
import { id, timestamps } from './columns'
import { workspaces } from './workspaces'

export const uploadKind = pgEnum('upload_kind', [
  'avatar',
  'workspace_icon',
  'project_icon',
  'attachment',
])
export const uploadStatus = pgEnum('upload_status', ['pending', 'ready', 'deleted'])

/** Processed image variants keyed by name (`original`, `256`, `64`) → object key. */
export type UploadVariants = Partial<Record<'original' | '256' | '64', string>>

export const uploads = pgTable(
  'uploads',
  {
    id: id(),
    // Null for user-owned uploads (avatars); set for everything workspace-owned.
    workspaceId: uuid().references((): AnyPgColumn => workspaces.id, { onDelete: 'cascade' }),
    uploadedById: uuid()
      .notNull()
      .references((): AnyPgColumn => users.id, { onDelete: 'cascade' }),
    kind: uploadKind().notNull(),
    status: uploadStatus().notNull().default('pending'),
    objectKey: text().notNull().unique('uploads_object_key_unique'),
    contentType: text().notNull(),
    size: integer().notNull(),
    variants: jsonb().$type<UploadVariants>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index().on(t.workspaceId),
    index().on(t.uploadedById),
    index().on(t.status, t.createdAt),
    check('uploads_size_positive', sql`${t.size} > 0`),
    check(
      'uploads_owner',
      sql`(${t.kind} = 'avatar' AND ${t.workspaceId} IS NULL) OR (${t.kind} <> 'avatar' AND ${t.workspaceId} IS NOT NULL)`,
    ),
  ],
)
