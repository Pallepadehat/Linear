/**
 * Identifies this browser tab. Sent with every API request and with the realtime
 * subscription, so the server doesn't echo this tab's own changes back to it —
 * they're already applied optimistically (docs/domain.md → Realtime events).
 */
export const clientId = crypto.randomUUID()
