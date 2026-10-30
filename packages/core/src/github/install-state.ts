import { createHmac, timingSafeEqual } from 'node:crypto'

// The `state` round-trips through GitHub's install page, so it is signed: it binds the
// installation that comes back to the workspace and user that started the flow.

export type InstallState = { workspaceId: string; userId: string }

const TTL_MS = 10 * 60 * 1000

function sign(payload: string, secret: string) {
  // Prefixed so the shared secret can't be used to forge other signed values.
  return createHmac('sha256', secret).update(`github-install-state.${payload}`).digest('base64url')
}

export function signInstallState(state: InstallState, secret: string, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ w: state.workspaceId, u: state.userId, e: now + TTL_MS }),
  ).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

/** Null when the token is malformed, tampered with, or expired. */
export function verifyInstallState(
  token: string,
  secret: string,
  now = Date.now(),
): InstallState | null {
  const [payload, signature, ...rest] = token.split('.')
  if (!payload || !signature || rest.length > 0) return null
  const expected = Buffer.from(sign(payload, secret))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

  let data: unknown
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const { w, u, e } = data as Record<string, unknown>
  if (typeof w !== 'string' || typeof u !== 'string' || typeof e !== 'number') return null
  if (now > e) return null
  return { workspaceId: w, userId: u }
}
