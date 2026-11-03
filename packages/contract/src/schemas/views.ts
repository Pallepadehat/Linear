import { z } from 'zod'
import { nameSchema, workspaceScopedSchema } from './common'
import { displayOptionsSchema } from './display-options'
import { issueFiltersSchema } from './issues'

/**
 * Saved issue views (docs/domain.md → Views). A view stores the user filters of
 * `issueFiltersSchema` and the display options of M7-03, nothing page-specific.
 */

/** Icon names the app maps to its own icons. */
export const VIEW_ICONS = [
  'layers',
  'list',
  'star',
  'zap',
  'bug',
  'flag',
  'target',
  'inbox',
  'bookmark',
] as const
/** Semantic color token keys (docs/design.md); never hex. */
export const VIEW_COLORS = [
  'neutral',
  'primary',
  'started',
  'completed',
  'success',
  'urgent',
] as const

export const viewIconSchema = z.enum(VIEW_ICONS)
export const viewColorSchema = z.enum(VIEW_COLORS)
export const viewScopeSchema = z.enum(['workspace', 'team'])

/**
 * The page's scope and values derived from display options or the clock: not part of
 * what a view saves. Every other list filter (current and future) is saved.
 */
const NON_VIEW_FILTER_KEYS = {
  workspaceSlug: true,
  teamId: true,
  projectId: true,
  cycleId: true,
  assignee: true,
  creator: true,
  statusCategories: true,
  completedAfter: true,
  today: true,
  showSubIssues: true,
  excludeSubtreeOf: true,
} as const

/** The user filters of `issues.list`, as a view stores them. Unknown keys are rejected. */
export const viewFiltersSchema = issueFiltersSchema.omit(NON_VIEW_FILTER_KEYS).strict()

/** The display options of M7-03 (layout, grouping, ordering + direction, properties…). */
export const viewDisplaySchema = displayOptionsSchema

export type ViewFilters = z.output<typeof viewFiltersSchema>
export type ViewFiltersInput = z.input<typeof viewFiltersSchema>
export type ViewDisplay = z.infer<typeof viewDisplaySchema>

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

/** JSON stores dates as strings; give date fields a second chance as a `Date`. */
function parseField(schema: z.ZodType, value: unknown) {
  const parsed = schema.safeParse(value)
  if (parsed.success || typeof value !== 'string' || !ISO_DATE_TIME.test(value)) return parsed
  return schema.safeParse(new Date(value))
}

/**
 * Reads stored JSON field by field: a field that no longer parses (renamed, removed,
 * or a value the schema now rejects) is dropped, never trusted or fatal.
 */
function parseStored<S extends z.ZodObject>(schema: S, stored: unknown) {
  const record =
    typeof stored === 'object' && stored !== null && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {}
  const result: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(schema.shape as Record<string, z.ZodType>)) {
    if (!(key in record)) continue
    const parsed = parseField(field, record[key])
    if (parsed.success && parsed.data !== undefined) result[key] = parsed.data
  }
  return result
}

export function parseStoredViewFilters(stored: unknown): ViewFilters {
  // Fields with defaults fill in when missing.
  return viewFiltersSchema.parse(parseStored(viewFiltersSchema, stored))
}

/** Missing fields fall back to the app's defaults (`parseDisplayOptions`). */
export function parseStoredViewDisplay(stored: unknown): Partial<ViewDisplay> {
  return parseStored(viewDisplaySchema, stored) as Partial<ViewDisplay>
}

export const viewOwnerSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  avatarUrl: z.url().nullable(),
})

export const viewSchema = z.object({
  id: z.uuid(),
  /** `null` = workspace view. */
  teamId: z.uuid().nullable(),
  scope: viewScopeSchema,
  name: z.string(),
  icon: viewIconSchema,
  color: viewColorSchema,
  filters: viewFiltersSchema,
  /** Stored options that still parse; the app fills the rest with its defaults. */
  display: viewDisplaySchema.partial(),
  /** `false` = private, visible only to its owner. */
  shared: z.boolean(),
  owner: viewOwnerSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const listViewsInputSchema = workspaceScopedSchema.extend({
  /** Only that team's views; omitted = every view (workspace and team views). */
  teamId: z.uuid().optional(),
})

export const viewIdInputSchema = workspaceScopedSchema.extend({ id: z.uuid() })

export const viewNameSchema = nameSchema

export const createViewInputSchema = workspaceScopedSchema.extend({
  name: viewNameSchema,
  icon: viewIconSchema.default('layers'),
  color: viewColorSchema.default('neutral'),
  /** Set once at creation; `null` or omitted = workspace view. */
  teamId: z.uuid().nullable().optional(),
  filters: viewFiltersSchema,
  display: viewDisplaySchema,
  shared: z.boolean().default(true),
})

/** Omitted fields are left unchanged; the scope (team) can't change. */
export const updateViewInputSchema = workspaceScopedSchema.extend({
  id: z.uuid(),
  name: viewNameSchema.optional(),
  icon: viewIconSchema.optional(),
  color: viewColorSchema.optional(),
  filters: viewFiltersSchema.optional(),
  display: viewDisplaySchema.optional(),
  shared: z.boolean().optional(),
})

export type ViewIcon = z.infer<typeof viewIconSchema>
export type ViewColor = z.infer<typeof viewColorSchema>
export type ViewScope = z.infer<typeof viewScopeSchema>
export type View = z.infer<typeof viewSchema>
export type ListViewsInput = z.input<typeof listViewsInputSchema>
export type CreateViewInput = z.input<typeof createViewInputSchema>
export type UpdateViewInput = z.input<typeof updateViewInputSchema>
