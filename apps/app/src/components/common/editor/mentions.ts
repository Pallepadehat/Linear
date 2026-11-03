import { Node, type AnyExtension } from '@tiptap/core'
import type { Trigger, SuggestionMatch } from '@tiptap/suggestion'

// @mentions (docs/domain.md → Mentions). A user mention is stored as
// `@[Ada Lovelace](user:<id>)`; an issue mention is the plain identifier (`TIP-12`),
// so the markdown stays readable outside the app. Both render as chips.

const USER_MENTION = /^@\[((?:[^\]\\\n]|\\.)*)\]\(user:([0-9a-fA-F-]{36})\)/
// Same rules as `parseMentions` in packages/core: uppercase key, not inside a word or URL.
const ISSUE_IDENTIFIER = /^([A-Z][A-Z0-9]{1,9})-([1-9]\d{0,8})(?![\w-])/
const ISSUE_START = /(?<![\w/-])[A-Z][A-Z0-9]{1,9}-[1-9]\d{0,8}(?![\w-])/

const escapeLabel = (label: string) => label.replace(/[\\[\]]/g, '\\$&')
const unescapeLabel = (label: string) => label.replace(/\\(.)/g, '$1')

export const UserMention = Node.create({
  name: 'userMention',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return {
      id: { default: null, parseHTML: (el) => el.getAttribute('data-id') },
      label: { default: '', parseHTML: (el) => el.getAttribute('data-label') ?? '' },
    }
  },
  parseHTML: () => [{ tag: 'span[data-user-mention]' }],
  renderHTML: ({ node }) => [
    'span',
    {
      'data-user-mention': '',
      'data-id': node.attrs.id,
      'data-label': node.attrs.label,
      class: 'mention',
    },
    `@${node.attrs.label}`,
  ],
  renderText: ({ node }) => `@${node.attrs.label}`,
  markdownTokenizer: {
    name: 'userMention',
    level: 'inline',
    start: (src: string) => src.indexOf('@['),
    tokenize: (src) => {
      const match = USER_MENTION.exec(src)
      if (!match) return undefined
      return {
        type: 'userMention',
        raw: match[0],
        label: unescapeLabel(match[1] ?? ''),
        id: match[2]!.toLowerCase(),
      }
    },
  },
  parseMarkdown: (token) => ({
    type: 'userMention',
    attrs: { id: token.id as string, label: token.label as string },
  }),
  renderMarkdown: (node) =>
    `@[${escapeLabel(String(node.attrs?.label ?? ''))}](user:${String(node.attrs?.id ?? '')})`,
})

export const IssueMention = Node.create({
  name: 'issueMention',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return {
      identifier: { default: '', parseHTML: (el) => el.getAttribute('data-identifier') ?? '' },
    }
  },
  parseHTML: () => [{ tag: 'span[data-issue-mention]' }],
  renderHTML: ({ node }) => [
    'span',
    { 'data-issue-mention': '', 'data-identifier': node.attrs.identifier, class: 'mention' },
    node.attrs.identifier,
  ],
  renderText: ({ node }) => node.attrs.identifier,
  markdownTokenizer: {
    name: 'issueMention',
    level: 'inline',
    start: (src: string) => src.search(ISSUE_START),
    tokenize: (src) => {
      const match = ISSUE_IDENTIFIER.exec(src)
      if (!match) return undefined
      return { type: 'issueMention', raw: match[0], identifier: match[0] }
    },
  },
  parseMarkdown: (token) => ({
    type: 'issueMention',
    attrs: { identifier: token.identifier as string },
  }),
  renderMarkdown: (node) => String(node.attrs?.identifier ?? ''),
})

export const mentionNodes: AnyExtension[] = [UserMention, IssueMention]

/**
 * The issue search trigger: `#query`, or a word that already looks like an identifier
 * (`TIP-1`, `tip-12`), at the start of a word. The query is what to search for.
 */
export function findIssueSuggestion({ $position }: Trigger): SuggestionMatch {
  const before = $position.parent.textBetween(
    Math.max(0, $position.parentOffset - 40),
    $position.parentOffset,
    undefined,
    '￼',
  )
  const match = /(?:^|\s)(#([^\s#]*)|([A-Za-z][A-Za-z0-9]{1,9}-\d+))$/.exec(before)
  if (!match) return null
  const text = match[1]!
  const from = $position.pos - text.length
  return {
    range: { from, to: $position.pos },
    query: match[2] ?? match[3] ?? '',
    text,
  }
}
