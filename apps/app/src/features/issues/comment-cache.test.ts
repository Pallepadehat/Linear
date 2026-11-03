import type { CommentThread, CommentsPage } from '@linear/contract'
import type { InfiniteData } from '@tanstack/vue-query'
import { describe, expect, it } from 'vitest'
import { patchCommentInPages, toggleReaction } from './comment-cache'

describe('toggleReaction', () => {
  it('adds a new pill or joins an existing one', () => {
    expect(toggleReaction([], '👍', true)).toEqual([{ emoji: '👍', count: 1, reactedByMe: true }])
    expect(toggleReaction([{ emoji: '👍', count: 2, reactedByMe: false }], '👍', true)).toEqual([
      { emoji: '👍', count: 3, reactedByMe: true },
    ])
  })

  it('leaves a pill, dropping it at zero', () => {
    expect(toggleReaction([{ emoji: '🎉', count: 2, reactedByMe: true }], '🎉', false)).toEqual([
      { emoji: '🎉', count: 1, reactedByMe: false },
    ])
    expect(toggleReaction([{ emoji: '🎉', count: 1, reactedByMe: true }], '🎉', false)).toEqual([])
  })

  it('is a no-op when already in that state', () => {
    const reactions = [{ emoji: '👀' as const, count: 1, reactedByMe: true }]
    expect(toggleReaction(reactions, '👀', true)).toBe(reactions)
    expect(toggleReaction([], '👀', false)).toEqual([])
  })
})

function thread(id: string, replyIds: string[] = []): CommentThread {
  const base = {
    issueId: 'i',
    author: { id: 'u', name: 'Ada', avatarUrl: null },
    body: id,
    reactions: [],
    resolvedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }
  return {
    ...base,
    id,
    parentId: null,
    replies: replyIds.map((r) => ({ ...base, id: r, body: r, parentId: id })),
    replyCount: replyIds.length,
  }
}

describe('patchCommentInPages', () => {
  const data: InfiniteData<CommentsPage> = {
    pages: [{ items: [thread('a', ['a1', 'a2']), thread('b')], nextCursor: null }],
    pageParams: [null],
  }
  const rename = <C extends { body: string }>(c: C) => ({ ...c, body: 'changed' })

  it('patches a root or a reply and nothing else', () => {
    const root = patchCommentInPages(data, 'b', rename)!.pages[0]!.items
    expect(root.map((t) => t.body)).toEqual(['a', 'changed'])
    const reply = patchCommentInPages(data, 'a2', rename)!.pages[0]!.items
    expect(reply[0]!.replies.map((r) => r.body)).toEqual(['a1', 'changed'])
    expect(reply[1]).toBe(data.pages[0]!.items[1])
  })

  it('passes through an empty cache', () => {
    expect(patchCommentInPages(undefined, 'a', rename)).toBeUndefined()
  })
})
