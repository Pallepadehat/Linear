import type { Notification } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import { neighborAfterRemoval, patchNotificationPages } from './notification-cache'

const n = (id: string) => ({ id, readAt: null }) as Notification

describe('patchNotificationPages', () => {
  const data = {
    pages: [
      { items: [n('a'), n('b')], nextCursor: 'b' },
      { items: [n('c')], nextCursor: null },
    ],
    pageParams: [null, 'b'],
  }

  it('patches one notification or all of them', () => {
    const read = new Date()
    const one = patchNotificationPages(data, 'c', (x) => ({ ...x, readAt: read }))
    expect(one!.pages[1]!.items[0]!.readAt).toBe(read)
    expect(one!.pages[0]!.items.map((x) => x.readAt)).toEqual([null, null])
    const all = patchNotificationPages(data, null, (x) => ({ ...x, readAt: read }))
    expect(all!.pages.flatMap((p) => p.items).every((x) => x.readAt === read)).toBe(true)
  })

  it('removes a notification when the patch returns null', () => {
    const next = patchNotificationPages(data, 'a', () => null)
    expect(next!.pages.map((p) => p.items.map((x) => x.id))).toEqual([['b'], ['c']])
  })
})

describe('neighborAfterRemoval', () => {
  it('moves to the next row, else the previous one', () => {
    const items = [n('a'), n('b'), n('c')]
    expect(neighborAfterRemoval(items, 'b')?.id).toBe('c')
    expect(neighborAfterRemoval(items, 'c')?.id).toBe('b')
    expect(neighborAfterRemoval([n('a')], 'a')).toBeNull()
  })
})
