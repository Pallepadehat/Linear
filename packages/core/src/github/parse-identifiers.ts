import type { LinkType } from '../automation/evaluate'

// Rules from docs/domain.md → GitHub PR linking. Candidates are not validated
// against the workspace here; unknown team keys and numbers are dropped by the caller.

export interface PrIdentifierCandidate {
  teamKey: string
  number: number
  type: LinkType
}

export interface PrIdentifierSource {
  branch?: string | null
  title?: string | null
  /** GitHub sends `null` for an empty PR description. */
  body?: string | null
}

const IDENTIFIER = String.raw`\b([A-Za-z][A-Za-z0-9]{1,9})-(\d+)\b`
const IDENTIFIER_PATTERN = new RegExp(IDENTIFIER, 'g')
const BRANCH_SEGMENT_PATTERN = /^([a-z][a-z0-9]{1,9})-(\d+)(?:-|$)/i
const CLOSING_KEYWORD_PATTERN = new RegExp(
  String.raw`\b(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\s*:?\s*${IDENTIFIER}`,
  'gi',
)

export function parsePrIdentifiers({
  branch,
  title,
  body,
}: PrIdentifierSource): PrIdentifierCandidate[] {
  const found = new Map<string, PrIdentifierCandidate>()

  const add = (key: string, digits: string, type: LinkType) => {
    const number = Number(digits)
    // Issue numbers start at 1; ignore zero and digit runs too long to be a real number.
    if (!Number.isSafeInteger(number) || number < 1) return
    const teamKey = key.toUpperCase()
    const id = `${teamKey}-${number}`
    const existing = found.get(id)
    if (!existing) found.set(id, { teamKey, number, type })
    else if (type === 'closing') existing.type = 'closing'
  }

  for (const segment of branch?.split('/') ?? []) {
    const match = BRANCH_SEGMENT_PATTERN.exec(segment)
    if (match) add(match[1]!, match[2]!, 'closing')
  }

  for (const match of title?.matchAll(IDENTIFIER_PATTERN) ?? []) {
    add(match[1]!, match[2]!, 'closing')
  }

  if (body) {
    for (const match of body.matchAll(CLOSING_KEYWORD_PATTERN)) add(match[1]!, match[2]!, 'closing')
    // `refs`/`ref`/`related to`/`part of` and bare mentions are all references, so one
    // pass covers them; identifiers already found as closing keep that type.
    for (const match of body.matchAll(IDENTIFIER_PATTERN)) add(match[1]!, match[2]!, 'reference')
  }

  return [...found.values()]
}
