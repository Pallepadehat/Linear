import { describe, expect, it } from 'vitest'
import { parsePrIdentifiers } from './parse-identifiers'

const closing = (teamKey: string, number: number) => ({ teamKey, number, type: 'closing' })
const reference = (teamKey: string, number: number) => ({ teamKey, number, type: 'reference' })

describe('parsePrIdentifiers', () => {
  describe('branch', () => {
    it.each(['tip-200-fix-login', 'feat/tip-200', 'tip-200', 'TIP-200-fix', 'user/feat/tip-200-x'])(
      'links %s as closing',
      (branch) => {
        expect(parsePrIdentifiers({ branch })).toEqual([closing('TIP', 200)])
      },
    )

    it.each([
      'fix-tip-200',
      'feat/support-utf-8',
      'fix-utf-8-handling',
      'feat/upgrade-sha-256-hashing',
      'tip200',
      'tip-200x',
      't-200',
      'abcdefghijk-1',
      'main',
    ])('ignores %s', (branch) => {
      expect(parsePrIdentifiers({ branch })).toEqual([])
    })

    it('reads every segment', () => {
      expect(parsePrIdentifiers({ branch: 'tip-1/eng-2-x' })).toEqual([
        closing('TIP', 1),
        closing('ENG', 2),
      ])
    })
  })

  describe('title', () => {
    it('links identifiers as closing', () => {
      expect(parsePrIdentifiers({ title: 'TIP-200 Fix login validation' })).toEqual([
        closing('TIP', 200),
      ])
    })

    it('finds identifiers anywhere in the title', () => {
      expect(parsePrIdentifiers({ title: 'Fix login (TIP-200, eng-7)' })).toEqual([
        closing('TIP', 200),
        closing('ENG', 7),
      ])
    })
  })

  describe('body', () => {
    it.each([
      'fixes',
      'fix',
      'fixed',
      'closes',
      'close',
      'closed',
      'resolves',
      'resolve',
      'resolved',
    ])('links "%s TIP-200" as closing', (keyword) => {
      expect(parsePrIdentifiers({ body: `${keyword} TIP-200` })).toEqual([closing('TIP', 200)])
    })

    it.each(['refs', 'ref', 'related to', 'part of'])(
      'links "%s TIP-200" as reference',
      (keyword) => {
        expect(parsePrIdentifiers({ body: `${keyword} TIP-200` })).toEqual([reference('TIP', 200)])
      },
    )

    it('links a bare identifier as reference', () => {
      expect(parsePrIdentifiers({ body: 'see TIP-200' })).toEqual([reference('TIP', 200)])
    })

    it('accepts a colon and extra whitespace after the keyword', () => {
      expect(parsePrIdentifiers({ body: 'Fixes:  TIP-1\nCloses:TIP-2' })).toEqual([
        closing('TIP', 1),
        closing('TIP', 2),
      ])
    })

    it('applies a keyword only to the identifier right after it', () => {
      expect(parsePrIdentifiers({ body: 'Fixes TIP-1, TIP-2' })).toEqual([
        closing('TIP', 1),
        reference('TIP', 2),
      ])
    })

    it('does not treat keywords embedded in other words as closing', () => {
      expect(parsePrIdentifiers({ body: 'prefixes TIP-1, unclosed TIP-2' })).toEqual([
        reference('TIP', 1),
        reference('TIP', 2),
      ])
    })

    it('handles a null body', () => {
      expect(parsePrIdentifiers({ title: 'Chore', body: null })).toEqual([])
    })
  })

  it('is case-insensitive and returns uppercase keys', () => {
    expect(
      parsePrIdentifiers({
        branch: 'Tip-1-x',
        title: 'eNg-2 thing',
        body: 'FIXES ops-3, refs Web-4',
      }),
    ).toEqual([closing('TIP', 1), closing('ENG', 2), closing('OPS', 3), reference('WEB', 4)])
  })

  it('finds multiple issues across all sources', () => {
    expect(
      parsePrIdentifiers({
        branch: 'feat/tip-1-login',
        title: 'TIP-2: login form',
        body: 'Fixes TIP-3\nRefs TIP-4\nAlso touches ENG-5.',
      }),
    ).toEqual([
      closing('TIP', 1),
      closing('TIP', 2),
      closing('TIP', 3),
      reference('TIP', 4),
      reference('ENG', 5),
    ])
  })

  it('deduplicates repeated identifiers', () => {
    expect(
      parsePrIdentifiers({
        branch: 'tip-200-fix',
        title: 'TIP-200 fix',
        body: 'Fixes tip-200. See TIP-200 and TIP-0200.',
      }),
    ).toEqual([closing('TIP', 200)])
    expect(parsePrIdentifiers({ body: 'TIP-5 TIP-5 refs tip-5' })).toEqual([reference('TIP', 5)])
  })

  it('lets closing win over reference regardless of order', () => {
    expect(parsePrIdentifiers({ body: 'Refs TIP-1. Later: fixes TIP-1' })).toEqual([
      closing('TIP', 1),
    ])
    expect(parsePrIdentifiers({ body: 'see TIP-2', title: 'TIP-2 title' })).toEqual([
      closing('TIP', 2),
    ])
  })

  it.each([
    'Encode as utf8',
    'TIP-200abc',
    'TIP_200',
    'T-200',
    'ABCDEFGHIJK-1',
    '1TIP-2',
    'TIP-0',
    'TIP-99999999999999999999',
  ])('ignores non-identifiers in text: %s', (text) => {
    expect(parsePrIdentifiers({ title: text, body: text })).toEqual([])
  })

  it('returns nothing for empty input', () => {
    expect(parsePrIdentifiers({})).toEqual([])
    expect(parsePrIdentifiers({ branch: '', title: '', body: '' })).toEqual([])
  })
})
