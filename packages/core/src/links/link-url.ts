import { DomainError } from '../errors'

// Pure helpers shared by every kind of link (issue links now, project links later).

/** A parsed `http(s)` URL, or `BAD_REQUEST`. Contracts validate first; this guards other callers. */
export function parseWebUrl(url: string): URL {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new DomainError('BAD_REQUEST', 'Invalid URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new DomainError('BAD_REQUEST', 'Only http and https links are allowed')
  }
  return parsed
}

/** `https://www.github.com/a` → `github.com`. Shown next to the title. */
export function linkHostname(url: string): string {
  return parseWebUrl(url).hostname.replace(/^www\./, '')
}

/**
 * The title to store: the trimmed title, or the URL's hostname when it is empty.
 * Never fetches the page (no SSRF surface).
 */
export function resolveLinkTitle(url: string, title: string | null | undefined): string {
  const trimmed = title?.trim()
  return trimmed ? trimmed : linkHostname(url)
}
