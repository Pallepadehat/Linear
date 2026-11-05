// Imported here, not only in main.ts: this module runs from a shared chunk evaluated before main.
import './random-uuid-polyfill'

/**
 * Identifies this browser tab. Sent with every API request and with the realtime
 * subscription, so the server doesn't echo this tab's own changes back to it —
 * they're already applied optimistically (docs/domain.md → Realtime events).
 */
export const clientId = crypto.randomUUID()
