import { z } from 'zod'
import { workspaceScopedSchema } from './common'

/** Issue counts; `scope` is every issue in the cycle except canceled ones. */
export const cycleProgressSchema = z.object({
  scope: z.number().int(),
  started: z.number().int(),
  completed: z.number().int(),
})

export const cycleSchema = z.object({
  id: z.uuid(),
  teamId: z.uuid(),
  number: z.number().int(),
  /** Null shows as "Cycle <number>". */
  name: z.string().nullable(),
  /** Half-open window `[startsAt, endsAt)` on UTC calendar days. */
  startsAt: z.date(),
  endsAt: z.date(),
  completedAt: z.date().nullable(),
  progress: cycleProgressSchema,
})

/** One value per cycle day (index 0 = start day); null for days without a snapshot. */
export const cycleSnapshotSchema = z.array(z.number().int().nullable())

export const cycleDetailSchema = cycleSchema.extend({
  scopeSnapshot: cycleSnapshotSchema,
  completedSnapshot: cycleSnapshotSchema,
})

export const listCyclesInputSchema = workspaceScopedSchema.extend({ teamId: z.uuid() })
export const cycleIdInputSchema = workspaceScopedSchema.extend({ id: z.uuid() })
export const updateCycleInputSchema = workspaceScopedSchema.extend({
  id: z.uuid(),
  /** Blank or null clears the name. */
  name: z.string().trim().max(80).nullable().optional(),
})

export type CycleProgress = z.infer<typeof cycleProgressSchema>
export type Cycle = z.infer<typeof cycleSchema>
export type CycleDetail = z.infer<typeof cycleDetailSchema>
export type UpdateCycleInput = z.input<typeof updateCycleInputSchema>
