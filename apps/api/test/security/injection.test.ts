import { issues } from '@linear/db'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { setupTestApp, signUp } from '../harness'

// SQL injection and stored XSS (OWASP A03 Injection). Drizzle sends every value as a bound
// parameter, so payloads are stored and searched as plain text; the Vue app escapes text on
// output (apps/app/e2e/security.spec.ts proves that in a browser).
const { app, db } = await setupTestApp()

const SQL_PAYLOADS = [
  "' OR '1'='1",
  "'; DROP TABLE issues; --",
  "' UNION SELECT email, password FROM accounts --",
  '1; SELECT pg_sleep(5)',
  '%',
  '_',
  '\\',
]

const XSS_PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '"><svg onload=alert(1)>',
  'javascript:alert(1)',
]

async function arrange() {
  const owner = await signUp(app, 'Owner')
  const { team } = await owner.client.workspaces.create({
    name: 'Tip',
    slug: 'tip',
    team: { name: 'Tip', key: 'TIP' },
  })
  const create = (title: string) =>
    owner.client.issues.create({ workspaceSlug: 'tip', teamId: team!.id, title })
  await create('Fix login validation')
  await create('Improve search')
  return { owner, create }
}

describe('security: SQL injection', () => {
  it.each(SQL_PAYLOADS)('treats %j in the search box as text', async (payload) => {
    const { owner } = await arrange()
    const started = Date.now()
    const { items } = await owner.client.issues.list({ workspaceSlug: 'tip', q: payload })
    // No issue title contains the payload, so nothing matches — not "everything" (1=1).
    expect(items).toEqual([])
    // pg_sleep never ran.
    expect(Date.now() - started).toBeLessThan(2000)
  })

  it('treats a payload in the content filter as text', async () => {
    const { owner } = await arrange()
    const { items } = await owner.client.issues.list({
      workspaceSlug: 'tip',
      content: "' OR '1'='1",
    })
    expect(items).toEqual([])
  })

  it('stores a payload title verbatim and leaves the table intact', async () => {
    const { owner, create } = await arrange()
    const issue = await create("'; DROP TABLE issues; --")

    const [row] = await db.select().from(issues).where(eq(issues.id, issue.id))
    expect(row!.title).toBe("'; DROP TABLE issues; --")
    const { items } = await owner.client.issues.list({ workspaceSlug: 'tip' })
    expect(items).toHaveLength(3)
  })

  it('rejects a payload where only a slug or an id is allowed (input validation)', async () => {
    const { owner } = await arrange()
    await expect(
      owner.client.issues.list({ workspaceSlug: "tip' OR '1'='1" }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(
      owner.client.issues.get({ workspaceSlug: 'tip', id: "1' OR '1'='1" }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

describe('security: stored XSS', () => {
  it.each(XSS_PAYLOADS)('returns %j as inert JSON text', async (payload) => {
    const { owner, create } = await arrange()
    const issue = await create(payload)

    const fetched = await owner.client.issues.get({ workspaceSlug: 'tip', id: issue.id })
    // Stored exactly as typed: escaping is the renderer's job, not a lossy input filter.
    expect(fetched.title).toBe(payload)
  })

  it('serves API responses as JSON, never as HTML a browser would render', async () => {
    const { owner } = await arrange()
    const res = await app.inject({
      method: 'POST',
      url: '/rpc/issues/list',
      headers: { cookie: owner.cookie, 'content-type': 'application/json' },
      payload: { json: { workspaceSlug: 'tip' } },
    })
    expect(res.headers['content-type']).toMatch(/^application\/json/)
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('refuses uploads a browser could run as a page or script (HTML, SVG)', async () => {
    const { owner } = await arrange()
    for (const contentType of ['text/html', 'image/svg+xml', 'application/javascript']) {
      await expect(
        owner.client.uploads.createPresignedUpload({
          kind: 'attachment',
          workspaceSlug: 'tip',
          contentType,
          size: 100,
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    }
  })
})
