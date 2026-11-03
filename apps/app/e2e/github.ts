import { createHmac, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { apiUrl, demoRepo, webhookSecret } from './config'

// The same fixtures the API acceptance tests use (docs/testing.md), retargeted at the demo repo.
const fixtureDir = new URL('../../api/test/fixtures/github/', import.meta.url)
const fixtures = {
  opened: 'pull_request.opened.json',
  merged: 'pull_request.closed.merged.json',
  closed: 'pull_request.closed.unmerged.json',
} as const

type PullRequestPayload = {
  action: string
  number: number
  pull_request: Record<string, unknown> & { head: Record<string, unknown> }
  repository: Record<string, unknown>
  installation?: Record<string, unknown>
}

export function pullRequestPayload(
  event: keyof typeof fixtures,
  pr: { number: number; branch: string; title: string },
): PullRequestPayload {
  const payload = JSON.parse(
    readFileSync(new URL(fixtures[event], fixtureDir), 'utf8'),
  ) as PullRequestPayload
  payload.number = pr.number
  payload.pull_request = {
    ...payload.pull_request,
    id: demoRepo.id * 10_000 + pr.number,
    number: pr.number,
    title: pr.title,
    html_url: `https://github.com/${demoRepo.fullName}/pull/${pr.number}`,
    head: { ...payload.pull_request.head, ref: pr.branch },
  }
  payload.repository = { ...payload.repository, id: demoRepo.id, full_name: demoRepo.fullName }
  payload.installation = { ...payload.installation, id: demoRepo.installationId }
  return payload
}

export function sign(body: string, secret = webhookSecret) {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
}

/** Posts a signed `pull_request` webhook to the real endpoint, like GitHub would. */
export async function sendPullRequestWebhook(payload: PullRequestPayload) {
  const body = JSON.stringify(payload)
  const res = await fetch(`${apiUrl}/webhooks/github`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-github-event': 'pull_request',
      'x-github-delivery': randomUUID(),
      'x-hub-signature-256': sign(body),
    },
    body,
  })
  if (!res.ok) throw new Error(`webhook rejected: HTTP ${res.status} ${await res.text()}`)
}
