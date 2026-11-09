// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  applyTyping,
  TYPING_TTL_MS,
  typingSentence,
  typingUserIds,
  type TypingState,
} from './typing'

describe('typing state', () => {
  const empty: TypingState = new Map()

  it('adds, refreshes and removes a typing user per issue', () => {
    let state = applyTyping(empty, 'i', 'ada', true, 0)
    state = applyTyping(state, 'i', 'bob', true, 100)
    expect(typingUserIds(state, 'i', 200)).toEqual(['ada', 'bob'])
    expect(typingUserIds(state, 'other', 200)).toEqual([])
    state = applyTyping(state, 'i', 'ada', false, 300)
    expect(typingUserIds(state, 'i', 300)).toEqual(['bob'])
    state = applyTyping(state, 'i', 'bob', false, 400)
    expect(state.size).toBe(0)
  })

  it('expires states that were not refreshed and skips yourself', () => {
    const state = applyTyping(applyTyping(empty, 'i', 'ada', true, 0), 'i', 'me', true, 0)
    expect(typingUserIds(state, 'i', TYPING_TTL_MS - 1, 'me')).toEqual(['ada'])
    expect(typingUserIds(state, 'i', TYPING_TTL_MS, 'me')).toEqual([])
  })

  it('never mutates the previous state', () => {
    const before = applyTyping(empty, 'i', 'ada', true, 0)
    applyTyping(before, 'i', 'bob', true, 0)
    expect(typingUserIds(before, 'i', 1)).toEqual(['ada'])
  })
})

describe('typingSentence', () => {
  it('names one, two or a count', () => {
    expect(typingSentence([])).toBe('')
    expect(typingSentence(['Ada'])).toBe('Ada is typing…')
    expect(typingSentence(['Ada', 'Bob'])).toBe('Ada and Bob are typing…')
    expect(typingSentence(['Ada', 'Bob', 'Cy'])).toBe('Ada and 2 others are typing…')
  })
})
