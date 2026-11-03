import type { Notification, NotificationPage } from '@linear/contract'
import type { InfiniteData } from '@tanstack/vue-query'

/** Applies `patch` to every copy of the notification; `null` removes it (archive, snooze). */
export function patchNotificationPages(
  data: InfiniteData<NotificationPage> | undefined,
  id: string | null,
  patch: (n: Notification) => Notification | null,
): InfiniteData<NotificationPage> | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.flatMap((n) => {
        if (id !== null && n.id !== id) return [n]
        const next = patch(n)
        return next ? [next] : []
      }),
    })),
  }
}

/** The notification after `id` in the list, else the one before it (where selection moves on removal). */
export function neighborAfterRemoval(items: readonly Notification[], id: string) {
  const index = items.findIndex((n) => n.id === id)
  if (index === -1) return null
  return items[index + 1] ?? items[index - 1] ?? null
}
