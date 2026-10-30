import { describe, expect, it } from 'vitest'
import { filterSlashCommands, SLASH_COMMANDS } from './slash-commands'

describe('filterSlashCommands', () => {
  it('returns every command for an empty query', () => {
    expect(filterSlashCommands('')).toEqual(SLASH_COMMANDS)
  })

  it('matches labels and keyword prefixes, case-insensitively', () => {
    expect(filterSlashCommands('HEAD').map((c) => c.id)).toEqual(['h1', 'h2', 'h3'])
    expect(filterSlashCommands('todo').map((c) => c.id)).toEqual(['task'])
  })

  it('returns nothing for an unknown query', () => {
    expect(filterSlashCommands('zzz')).toEqual([])
  })
})
