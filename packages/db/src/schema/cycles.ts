import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { id, timestamps } from './columns'
import { teams } from './teams'
import { workspaces } from './workspaces'

/** One value per cycle day (index 0 = the start day); `null` for days with no snapshot. */
export type CycleSnapshot = (number | null)[]

/**
 * A team's time-boxed iteration (docs/domain.md → Cycles). Windows are half-open,
 * `[startsAt, endsAt)`, and scheduled by the `cycles-maintain` job.
 */
export const cycles = pgTable(
  'cycles',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    // Per team, 1, 2, 3… in date order; never reused.
    number: integer().notNull(),
    name: text(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    // Set once the cycle has ended and the maintenance job has closed it.
    completedAt: timestamp({ withTimezone: true }),
    // Daily points for the burn-up chart.
    scopeSnapshot: jsonb().$type<CycleSnapshot>().notNull().default([]),
    completedSnapshot: jsonb().$type<CycleSnapshot>().notNull().default([]),
    ...timestamps,
  },
  (t) => [
    unique('cycles_team_id_number_unique').on(t.teamId, t.number),
    index().on(t.workspaceId),
    index().on(t.teamId, t.startsAt),
    check('cycles_ends_after_start', sql`${t.endsAt} > ${t.startsAt}`),
    check('cycles_number_positive', sql`${t.number} > 0`),
  ],
)
