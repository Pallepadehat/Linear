// Rules from docs/domain.md → Mentions. Candidates are not validated here: unknown
// users and identifiers are dropped by the caller (`syncMentions`).

/** Per kind; anything past it is ignored, so a pasted wall of identifiers can't fan out. */
export const MAX_MENTIONS = 50

export type ParsedMentions = {
  /** In first-seen order, each once. */
  userIds: string[]
  /** Uppercase `TEAM-12`, in first-seen order, each once. */
  issueIdentifiers: string[]
}

const FENCED_CODE = /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[`~]*[ \t]*$|(?![\s\S]))/gm
const CODE_SPAN = /(`+)[^`][\s\S]*?\1/g
// How the editor stores a user mention: `@[Ada Lovelace](user:<uuid>)`.
const USER_MENTION = /@\[(?:[^\]\\\n]|\\.)*\]\(user:([0-9a-fA-F-]{36})\)/g
// Link and image destinations, autolinks and bare URLs: an identifier in a URL isn't a mention.
const LINK_TARGET = /\]\([^)\s]*\)|<[a-z][a-z0-9+.-]*:[^>\s]*>|\b[a-z][a-z0-9+.-]*:\/\/\S+/gi
// Team keys are uppercase in text; `utf-8` or `covid-19` stay plain words.
const ISSUE_IDENTIFIER = /(?<![\w/-])([A-Z][A-Z0-9]{1,9})-(\d{1,9})(?![\w-])/g

/**
 * The users and issues a markdown body mentions. Code blocks and code spans are skipped,
 * duplicates removed, and each kind capped at `MAX_MENTIONS`.
 */
export function parseMentions(markdown: string | null | undefined): ParsedMentions {
  if (!markdown) return { userIds: [], issueIdentifiers: [] }
  const text = markdown.replace(FENCED_CODE, ' ').replace(CODE_SPAN, ' ')

  const userIds = new Set<string>()
  for (const match of text.matchAll(USER_MENTION)) {
    if (userIds.size >= MAX_MENTIONS) break
    userIds.add(match[1]!.toLowerCase())
  }

  const issueIdentifiers = new Set<string>()
  const prose = text.replace(USER_MENTION, ' ').replace(LINK_TARGET, ' ')
  for (const match of prose.matchAll(ISSUE_IDENTIFIER)) {
    if (issueIdentifiers.size >= MAX_MENTIONS) break
    const number = Number(match[2])
    // Issue numbers start at 1.
    if (number >= 1) issueIdentifiers.add(`${match[1]}-${number}`)
  }

  return { userIds: [...userIds], issueIdentifiers: [...issueIdentifiers] }
}

/** What `after` mentions that `before` didn't: the mentions an edit adds. */
export function addedMentions(
  before: string | null | undefined,
  after: string | null | undefined,
): ParsedMentions {
  const old = parseMentions(before)
  const next = parseMentions(after)
  return {
    userIds: next.userIds.filter((id) => !old.userIds.includes(id)),
    issueIdentifiers: next.issueIdentifiers.filter((id) => !old.issueIdentifiers.includes(id)),
  }
}
