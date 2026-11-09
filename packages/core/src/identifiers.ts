// Formats from docs/domain.md → Identifiers.
export const WORKSPACE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/
/** Slugs that would collide with top-level app or API routes. */
export const RESERVED_WORKSPACE_SLUGS: ReadonlySet<string> = new Set([
  'api',
  'rpc',
  'webhooks',
  'health',
  'login',
  'register',
  'setup',
  'settings',
])

export const TEAM_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/

export function normalizeTeamKey(key: string): string {
  return key.trim().toUpperCase()
}
