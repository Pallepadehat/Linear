import { index, pgTable, unique, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { id, timestamps } from './columns'
import { issues } from './issues'
import { workspaces } from './workspaces'

/** Who follows an issue; the audience for Inbox notifications (docs/domain.md → Subscribers). */
export const issueSubscriptions = pgTable(
  'issue_subscriptions',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    unique('issue_subscriptions_issue_id_user_id_unique').on(t.issueId, t.userId),
    // "Subscribed by me" filter and the Inbox (M10-02) look subscriptions up by user.
    index().on(t.userId, t.workspaceId),
  ],
)
