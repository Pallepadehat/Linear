import { loadDbEnv } from '@linear/env'
import { and, eq, sql } from 'drizzle-orm'
import { createDb } from './client'
import { issues, teams, users, workflowStatuses, workspaces } from './schema'

// Bulk demo issues for checking list performance: `bun run db:seed:issues 1200`.
// Run `bun run db:seed` first; numbers come from the team counter like real creates.
const count = Number(process.argv[2] ?? 1000)
if (!Number.isInteger(count) || count < 1) throw new Error('usage: seed-issues <count>')

const VERBS = ['Fix', 'Add', 'Refactor', 'Document', 'Investigate', 'Polish', 'Remove', 'Speed up']
const NOUNS = [
  'login redirect',
  'issue list scrolling',
  'webhook retries',
  'avatar upload',
  'dark mode contrast',
  'command menu',
  'label colors',
  'board drag and drop',
  'empty states',
  'keyboard shortcuts',
]

const env = loadDbEnv()
const { db, close } = createDb(env.DATABASE_URL, { max: 1 })

try {
  await db.transaction(async (tx) => {
    const [workspace] = await tx.select().from(workspaces).where(eq(workspaces.slug, 'tip'))
    const [user] = await tx.select().from(users).where(eq(users.email, 'demo@tip.dev'))
    if (!workspace || !user) throw new Error('run `bun run db:seed` first')
    const [team] = await tx
      .select()
      .from(teams)
      .where(and(eq(teams.workspaceId, workspace.id), eq(teams.key, 'TIP')))
    if (!team) throw new Error('demo team TIP not found')
    const statuses = await tx
      .select()
      .from(workflowStatuses)
      .where(eq(workflowStatuses.teamId, team.id))

    const [counter] = await tx
      .update(teams)
      .set({ issueCounter: sql`${teams.issueCounter} + ${count}` })
      .where(eq(teams.id, team.id))
      .returning({ last: teams.issueCounter })
    const first = counter!.last - count + 1

    const rows = Array.from({ length: count }, (_, i) => {
      const status = statuses[i % statuses.length]!
      return {
        workspaceId: workspace.id,
        teamId: team.id,
        number: first + i,
        title: `${VERBS[i % VERBS.length]} ${NOUNS[(i * 7) % NOUNS.length]}`,
        statusId: status.id,
        priority: (i * 3) % 5,
        assigneeId: i % 3 === 0 ? null : user.id,
        creatorId: user.id,
        completedAt: status.category === 'completed' ? new Date() : null,
      }
    })
    for (let i = 0; i < rows.length; i += 500) {
      await tx.insert(issues).values(rows.slice(i, i + 500))
    }
  })
  console.log(`seeded ${count} issues into TIP`)
} finally {
  await close()
}
