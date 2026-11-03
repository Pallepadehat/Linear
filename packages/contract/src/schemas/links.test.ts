import { describe, expect, it } from 'vitest'
import { linkFieldsSchema, linkUrlSchema } from './links'

describe('linkUrlSchema', () => {
  it.each(['https://example.com', 'http://localhost:3000/a?b=c#d', '  https://x.dev/path  '])(
    'accepts %s',
    (url) => {
      expect(linkUrlSchema.safeParse(url).success).toBe(true)
    },
  )

  it.each([
    'javascript:alert(1)',
    'ftp://example.com/file',
    'data:text/html,hi',
    'mailto:a@b.dev',
    'example.com',
    '',
    `https://example.com/${'a'.repeat(2048)}`,
  ])('rejects %s', (url) => {
    expect(linkUrlSchema.safeParse(url).success).toBe(false)
  })

  it('trims the url', () => {
    expect(linkUrlSchema.parse('  https://x.dev  ')).toBe('https://x.dev')
  })
})

describe('linkFieldsSchema', () => {
  it('rejects titles over 255 characters', () => {
    const result = linkFieldsSchema.safeParse({ url: 'https://x.dev', title: 'a'.repeat(256) })
    expect(result.success).toBe(false)
  })
})
