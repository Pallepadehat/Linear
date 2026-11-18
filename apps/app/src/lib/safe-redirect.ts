/**
 * The in-app path to go to after login, or `/`. Only same-origin paths pass: `//host` and
 * `/\host` are protocol-relative URLs to another site (open redirect, OWASP A01).
 */
export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/'
  if (value.startsWith('//') || value.startsWith('/\\')) return '/'
  return value
}
