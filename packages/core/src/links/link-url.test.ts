import { describe, expect, it } from 'vitest'
import { DomainError } from '../errors'
import { linkHostname, nextLinkTitle, parseWebUrl, resolveLinkTitle } from './link-url'

describe('linkHostname', () => {
  it('drops a leading www.', () => {
    expect(linkHostname('https://www.github.com/a/b')).toBe('github.com')
  })

  it('keeps other subdomains and drops the port', () => {
    expect(linkHostname('http://docs.example.dev:8080/x')).toBe('docs.example.dev')
  })
})

describe('resolveLinkTitle', () => {
  it('defaults an empty or blank title to the hostname', () => {
    expect(resolveLinkTitle('https://www.figma.com/file/1', undefined)).toBe('figma.com')
    expect(resolveLinkTitle('https://www.figma.com/file/1', '   ')).toBe('figma.com')
  })

  it('keeps a given title, trimmed', () => {
    expect(resolveLinkTitle('https://figma.com', '  Mockups ')).toBe('Mockups')
  })
})

describe('parseWebUrl', () => {
  it.each(['javascript:alert(1)', 'ftp://example.com', 'not a url'])('rejects %s', (url) => {
    expect(() => parseWebUrl(url)).toThrow(DomainError)
  })
})

describe('nextLinkTitle', () => {
  const current = { url: 'https://www.figma.com/file/1', title: 'figma.com' }

  it('uses an explicit title, or the hostname when it is blank', () => {
    expect(nextLinkTitle(current, current.url, ' Mockups ')).toBe('Mockups')
    expect(nextLinkTitle(current, 'https://notion.so/x', '')).toBe('notion.so')
  })

  it('moves a hostname title to the new URL', () => {
    expect(nextLinkTitle(current, 'https://notion.so/x', undefined)).toBe('notion.so')
  })

  it('keeps a custom title when only the URL changes', () => {
    expect(nextLinkTitle({ ...current, title: 'Mockups' }, 'https://notion.so/x', undefined)).toBe(
      'Mockups',
    )
  })
})
