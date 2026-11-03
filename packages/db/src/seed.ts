import { loadDbEnv } from '@linear/env'
import { hashPassword } from 'better-auth/crypto'
import { eq } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'
import { createDb } from './client'
import { DEFAULT_WORKFLOW_STATUSES } from './defaults'
import {
  accounts,
  teamMembers,
  teams,
  users,
  workflowStatuses,
  workspaceMembers,
  workspaces,
} from './schema'

// Demo data for local development and the school demo. Safe to re-run.
export const DEMO = {
  email: 'demo@tip.dev',
  password: 'password123',
  name: 'Demo User',
  workspace: { name: 'Tip', slug: 'tip' },
  team: { name: 'Tip Development', key: 'TIP' },
}

const env = loadDbEnv()
const { db, close } = createDb(env.DATABASE_URL, { max: 1 })

try {
  await db.transaction(async (tx) => {
    let [user] = await tx.select().from(users).where(eq(users.email, DEMO.email))
    if (!user) {
      ;[user] = await tx
        .insert(users)
        .values({ name: DEMO.name, email: DEMO.email, emailVerified: true })
        .returning()
      // Same shape Better Auth writes for email/password sign-up.
      await tx.insert(accounts).values({
        userId: user!.id,
        accountId: user!.id,
        providerId: 'credential',
        password: await hashPassword(DEMO.password),
      })
    }

    let [workspace] = await tx
      .select()
      .from(workspaces)
      .where(eq(workspaces.slug, DEMO.workspace.slug))
    if (!workspace) {
      ;[workspace] = await tx
        .insert(workspaces)
        .values({ ...DEMO.workspace, createdById: user!.id })
        .returning()
      await tx
        .insert(workspaceMembers)
        .values({ workspaceId: workspace!.id, userId: user!.id, role: 'owner' })
    }

    const [team] = await tx.select().from(teams).where(eq(teams.workspaceId, workspace!.id))
    if (!team) {
      const teamId = uuidv7()
      await tx.insert(teams).values({ id: teamId, workspaceId: workspace!.id, ...DEMO.team })
      const statuses = await tx
        .insert(workflowStatuses)
        .values(
          DEFAULT_WORKFLOW_STATUSES.map((s, position) => ({
            workspaceId: workspace!.id,
            teamId,
            ...s,
            position,
          })),
        )
        .returning()
      // Issue default status: Backlog (docs/domain.md → Team issue defaults).
      const backlog = statuses.find((s) => s.name === 'Backlog')
      await tx
        .update(teams)
        .set({ defaultStatusId: backlog?.id ?? null })
        .where(eq(teams.id, teamId))
      await tx.insert(teamMembers).values({ workspaceId: workspace!.id, teamId, userId: user!.id })
    }
  })
  console.log(`seeded: sign in as ${DEMO.email} / ${DEMO.password} → /${DEMO.workspace.slug}`)
} finally {
  await close()
}
