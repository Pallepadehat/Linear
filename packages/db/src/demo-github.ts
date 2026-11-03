// Demo the GitHub automation without a GitHub App or a public URL (README → "Demo without
// GitHub"). `connect` attaches a fake installation + repository to the seeded workspace;
// `open` / `merge` / `close` send signed `pull_request` webhooks to the real endpoint, so the
// signature check, queue, worker, linking and automation all run exactly as for GitHub.
//
//   bun run demo:github connect
//   bun run demo:github open tip-1-add-login ["TIP-1 Add login"]
//   bun run demo:github merge tip-1-add-login
//   bun run demo:github close tip-1-add-login
import { createHmac, randomUUID } from 'node:crypto'
import { loadDbEnv, loadRootEnvFile } from '@linear/env'
import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { githubInstallations, githubRepositories, workspaces } from './schema'

// Far above real GitHub IDs we'd see in a demo, so they never collide with a real install.
const DEMO_INSTALLATION_ID = 9_000_000_001
const DEMO_REPO_ID = 9_000_000_001
const DEMO_REPO = 'tip-demo/linear-demo'

const [command, branch, title] = process.argv.slice(2)

if (command === 'connect') await connect(process.env.DEMO_WORKSPACE ?? 'tip')
else if ((command === 'open' || command === 'merge' || command === 'close') && branch)
  await sendPullRequest(command, branch, title ?? branch)
else {
  console.error(
    'usage: demo:github connect | open <branch> [title] | merge <branch> | close <branch>',
  )
  process.exit(1)
}

async function connect(slug: string) {
  const { db, close } = createDb(loadDbEnv().DATABASE_URL, { max: 1 })
  try {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug))
    if (!workspace) throw new Error(`workspace "${slug}" not found; run db:seed first`)
    const [installation] = await db
      .insert(githubInstallations)
      .values({
        installationId: DEMO_INSTALLATION_ID,
        workspaceId: workspace.id,
        accountLogin: 'tip-demo',
      })
      .onConflictDoUpdate({
        target: githubInstallations.installationId,
        set: { workspaceId: workspace.id },
      })
      .returning()
    await db
      .insert(githubRepositories)
      .values({
        githubRepoId: DEMO_REPO_ID,
        workspaceId: workspace.id,
        installationId: installation!.id,
        fullName: DEMO_REPO,
      })
      .onConflictDoUpdate({
        target: githubRepositories.githubRepoId,
        set: { workspaceId: workspace.id, installationId: installation!.id },
      })
    console.log(`connected ${DEMO_REPO} to workspace "${slug}"`)
  } finally {
    await close()
  }
}

async function sendPullRequest(action: 'open' | 'merge' | 'close', branch: string, title: string) {
  loadRootEnvFile()
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) throw new Error('set GITHUB_WEBHOOK_SECRET (same value as the api) first')
  const url =
    process.env.WEBHOOK_URL ?? `http://localhost:${process.env.PORT ?? 3000}/webhooks/github`

  // The same branch always maps to the same PR, so open → merge updates one pull request.
  const number = [...branch].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 9973, 7) + 1
  const now = new Date().toISOString()
  const closed = action !== 'open'
  const payload = {
    action: closed ? 'closed' : 'opened',
    pull_request: {
      id: DEMO_REPO_ID * 10_000 + number,
      number,
      title,
      body: null,
      html_url: `https://github.com/${DEMO_REPO}/pull/${number}`,
      state: closed ? 'closed' : 'open',
      draft: false,
      merged: action === 'merge',
      merged_at: action === 'merge' ? now : null,
      closed_at: closed ? now : null,
      head: { ref: branch },
    },
    repository: { id: DEMO_REPO_ID, full_name: DEMO_REPO },
  }

  const body = JSON.stringify(payload)
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-github-event': 'pull_request',
      'x-github-delivery': randomUUID(),
      'x-hub-signature-256': signature,
    },
    body,
  })
  console.log(`${payload.action} #${number} (${branch}) → ${url}: HTTP ${res.status}`)
  if (!res.ok) process.exit(1)
}
