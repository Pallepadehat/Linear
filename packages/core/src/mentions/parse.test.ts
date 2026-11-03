import { describe, expect, it } from 'vitest'
import { addedMentions, MAX_MENTIONS, parseMentions } from './parse'

const ada = '0190a6f2-1c2b-7d3e-8f40-123456789abc'
const bob = '0190a6f2-1c2b-7d3e-8f40-123456789abd'
const mention = (name: string, id: string) => `@[${name}](user:${id})`

describe('parseMentions', () => {
  it('finds user mentions and issue identifiers', () => {
    expect(parseMentions(`Hey ${mention('Ada', ada)}, see TIP-12 and ENG-3.`)).toEqual({
      userIds: [ada],
      issueIdentifiers: ['TIP-12', 'ENG-3'],
    })
  })

  it('handles empty input', () => {
    expect(parseMentions(null)).toEqual({ userIds: [], issueIdentifiers: [] })
    expect(parseMentions('')).toEqual({ userIds: [], issueIdentifiers: [] })
  })

  it('de-duplicates in first-seen order', () => {
    const md = `${mention('Bob', bob)} ${mention('Ada', ada)} ${mention('Bobby', bob)} TIP-2 TIP-1 TIP-2 TIP-02`
    expect(parseMentions(md)).toEqual({ userIds: [bob, ada], issueIdentifiers: ['TIP-2', 'TIP-1'] })
  })

  it('normalizes user ids to lowercase', () => {
    expect(parseMentions(mention('Ada', ada.toUpperCase())).userIds).toEqual([ada])
  })

  it('accepts names with escaped brackets', () => {
    expect(parseMentions(`@[Ada \\[ops\\]](user:${ada})`).userIds).toEqual([ada])
  })

  it('ignores code blocks and code spans', () => {
    const md = [
      'Real: TIP-1',
      '```',
      `TIP-2 ${mention('Ada', ada)}`,
      '```',
      '~~~ts',
      'TIP-3',
      '~~~',
      `Inline \`TIP-4 ${mention('Bob', bob)}\` and \`\`TIP-5\`\``,
    ].join('\n')
    expect(parseMentions(md)).toEqual({ userIds: [], issueIdentifiers: ['TIP-1'] })
  })

  it('ignores an unterminated fence to the end', () => {
    expect(parseMentions('TIP-1\n```\nTIP-2').issueIdentifiers).toEqual(['TIP-1'])
  })

  it('ignores identifiers in URLs, link targets and lowercase words', () => {
    const md =
      '[the spec](https://example.com/TIP-9) <https://x.dev/TIP-8> https://linear.app/tip/issue/TIP-7 utf-8 tip-6 [TIP-5](https://x.dev)'
    expect(parseMentions(md).issueIdentifiers).toEqual(['TIP-5'])
  })

  it('needs word boundaries and a real number', () => {
    expect(
      parseMentions('aTIP-1 TIP-1x A-1 TIP-0 TIP-1-2 (TIP-3) TIP-4.').issueIdentifiers,
    ).toEqual(['TIP-3', 'TIP-4'])
  })

  it('does not read a user mention as plain text identifiers', () => {
    expect(parseMentions(mention('TIP-1 Bot', ada)).issueIdentifiers).toEqual([])
  })

  it('ignores user links that are not mentions', () => {
    expect(parseMentions(`[Ada](user:${ada}) @[Ada](user:nope)`).userIds).toEqual([])
  })

  it(`caps each kind at ${MAX_MENTIONS}`, () => {
    const md = Array.from({ length: MAX_MENTIONS + 10 }, (_, i) => `TIP-${i + 1}`).join(' ')
    const { issueIdentifiers } = parseMentions(md)
    expect(issueIdentifiers).toHaveLength(MAX_MENTIONS)
    expect(issueIdentifiers.at(-1)).toBe(`TIP-${MAX_MENTIONS}`)
  })
})

describe('addedMentions', () => {
  it('returns only what the edit adds', () => {
    expect(
      addedMentions(
        `${mention('Ada', ada)} TIP-1`,
        `${mention('Ada', ada)} ${mention('Bob', bob)} TIP-1 TIP-2`,
      ),
    ).toEqual({ userIds: [bob], issueIdentifiers: ['TIP-2'] })
  })

  it('treats everything as new on create', () => {
    expect(addedMentions(null, `${mention('Ada', ada)} TIP-1`)).toEqual({
      userIds: [ada],
      issueIdentifiers: ['TIP-1'],
    })
  })

  it('adds nothing when mentions are removed or kept', () => {
    expect(addedMentions(`${mention('Ada', ada)} TIP-1`, 'TIP-1 again')).toEqual({
      userIds: [],
      issueIdentifiers: [],
    })
  })
})
