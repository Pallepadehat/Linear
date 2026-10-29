import { z } from 'zod'

// Mirrors docs/domain.md → Identifiers. Kept here (not in core) so the app can validate forms.
/** Slugs that would collide with top-level app or API routes. */
export const RESERVED_WORKSPACE_SLUGS = [
  'api',
  'rpc',
  'webhooks',
  'health',
  'login',
  'register',
  'setup',
  'settings',
]

export const workspaceSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/, {
    message: '2–40 lowercase letters, digits or dashes; no leading or trailing dash',
  })
  .refine((slug) => !RESERVED_WORKSPACE_SLUGS.includes(slug), { message: 'That URL is reserved' })

export const teamKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]{1,9}$/, { message: '2–10 letters or digits, starting with a letter' })

export const nameSchema = z.string().trim().min(1, { message: 'Required' }).max(80)

/** Every workspace-scoped procedure identifies its workspace by slug. */
export const workspaceScopedSchema = z.object({ workspaceSlug: workspaceSlugSchema })
