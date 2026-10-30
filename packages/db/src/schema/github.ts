import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { id, timestamps } from './columns'
import { issues } from './issues'
import { workspaces } from './workspaces'

export const pullRequestState = pgEnum('pull_request_state', ['open', 'draft', 'closed', 'merged'])
export const pullRequestLinkType = pgEnum('pull_request_link_type', ['closing', 'reference'])
export const webhookDeliveryStatus = pgEnum('webhook_delivery_status', [
  'received',
  'processed',
  'ignored',
  'failed',
])

export const githubInstallations = pgTable(
  'github_installations',
  {
    id: id(),
    installationId: bigint({ mode: 'number' }).notNull().unique(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    accountLogin: text().notNull(),
    ...timestamps,
  },
  (t) => [index().on(t.workspaceId)],
)

export const githubRepositories = pgTable(
  'github_repositories',
  {
    id: id(),
    githubRepoId: bigint({ mode: 'number' }).notNull().unique(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    installationId: uuid()
      .notNull()
      .references(() => githubInstallations.id, { onDelete: 'cascade' }),
    fullName: text().notNull(),
    ...timestamps,
  },
  (t) => [index().on(t.workspaceId), index().on(t.installationId)],
)

export const pullRequests = pgTable(
  'pull_requests',
  {
    id: id(),
    githubPrId: bigint({ mode: 'number' }).notNull().unique(),
    repositoryId: uuid()
      .notNull()
      .references(() => githubRepositories.id, { onDelete: 'cascade' }),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    number: integer().notNull(),
    title: text().notNull(),
    url: text().notNull(),
    branch: text().notNull(),
    state: pullRequestState().notNull(),
    mergedAt: timestamp({ withTimezone: true }),
    closedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index().on(t.workspaceId), index().on(t.repositoryId)],
)

export const issuePullRequestLinks = pgTable(
  'issue_pull_request_links',
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    pullRequestId: uuid()
      .notNull()
      .references(() => pullRequests.id, { onDelete: 'cascade' }),
    type: pullRequestLinkType().notNull(),
    ...timestamps,
  },
  (t) => [
    unique('issue_pull_request_links_issue_id_pull_request_id_unique').on(
      t.issueId,
      t.pullRequestId,
    ),
    index().on(t.workspaceId),
    index().on(t.pullRequestId),
  ],
)

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: id(),
  deliveryId: text().notNull().unique(),
  event: text().notNull(),
  status: webhookDeliveryStatus().notNull().default('received'),
  error: text(),
  payload: jsonb().$type<Record<string, unknown>>().notNull(),
  ...timestamps,
})
