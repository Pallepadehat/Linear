import type { Notification } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import { patchNotificationPages } from './notification-cache'

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
