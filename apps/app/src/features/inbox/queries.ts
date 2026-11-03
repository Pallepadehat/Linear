import type { Notification, NotificationFilter, NotificationPage } from '@linear/contract'
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/vue-query'
import { toValue, type MaybeRefOrGetter } from 'vue'
import { toast } from 'vue-sonner'
import { errorMessage } from '@/lib/errors'
import { client, orpc } from '@/lib/orpc'
import { patchNotificationPages } from './notification-cache'

export const notificationsKey = () => orpc.notifications.key()
const listKey = () => orpc.notifications.list.key()

/** Newest-first Inbox pages. */
export const notificationListOptions = (workspaceSlug: string, filter: NotificationFilter) =>
  orpc.notifications.list.infiniteOptions({
    input: (cursor: string | null) => ({ workspaceSlug, filter, cursor, limit: 50 }),
    initialPageParam: null,
    getNextPageParam: (page) => page.nextCursor,
  })

export const unreadCountOptions = (workspaceSlug: string) =>
  orpc.notifications.unreadCount.queryOptions({ input: { workspaceSlug } })

type Change = {
  /** The notification's new state; null takes it out of the Inbox. */
  patch: (n: Notification) => Notification | null
  /** How the unread count moves. */
  unreadDelta: number
}

/**
 * Optimistic plumbing shared by every Inbox action: patch every cached list and the
 * unread count, roll back with a toast on error. Read toggles only refetch the count
 * afterwards, so the selected row doesn't jump out of the "Unread" list while open.
 */
function useNotificationMutation<V>(
  workspaceSlug: MaybeRefOrGetter<string>,
  options: {
    mutationFn: (slug: string, variables: V) => Promise<unknown>
    /** The notification it changes; null for all of them (mark all read). */
    target: (variables: V) => string | null
    change: (variables: V) => Change
    refetchLists: boolean
    errorTitle: string
  },
) {
  const queryClient = useQueryClient()
  const countKey = () => unreadCountOptions(toValue(workspaceSlug)).queryKey
  return useMutation({
    mutationFn: (variables: V) => options.mutationFn(toValue(workspaceSlug), variables),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: notificationsKey() })
      const lists = queryClient.getQueriesData<InfiniteData<NotificationPage>>({
        queryKey: listKey(),
      })
      const count = queryClient.getQueryData(countKey())
      const { patch, unreadDelta } = options.change(variables)
      queryClient.setQueriesData<InfiniteData<NotificationPage>>({ queryKey: listKey() }, (data) =>
        patchNotificationPages(data, options.target(variables), patch),
      )
      queryClient.setQueryData(countKey(), (old) =>
        old ? { count: Math.max(0, old.count + unreadDelta) } : old,
      )
      return { lists, count }
    },
    onError: (error, _variables, context) => {
      for (const [key, data] of context?.lists ?? []) queryClient.setQueryData(key, data)
      queryClient.setQueryData(countKey(), context?.count)
      toast.error(options.errorTitle, { description: errorMessage(error) })
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: options.refetchLists ? notificationsKey() : countKey(),
      }),
  })
}

const unreadOf = (n: Notification) => (n.readAt ? 0 : 1)

export function useMarkNotificationRead(workspaceSlug: MaybeRefOrGetter<string>) {
  return useNotificationMutation(workspaceSlug, {
    mutationFn: (slug, n: Notification) =>
      client.notifications.markRead({ workspaceSlug: slug, id: n.id }),
    target: (n) => n.id,
    change: (n) => ({
      patch: (x) => ({ ...x, readAt: x.readAt ?? new Date() }),
      unreadDelta: -unreadOf(n),
    }),
    refetchLists: false,
    errorTitle: "Couldn't mark as read",
  })
}

export function useMarkNotificationUnread(workspaceSlug: MaybeRefOrGetter<string>) {
  return useNotificationMutation(workspaceSlug, {
    mutationFn: (slug, n: Notification) =>
      client.notifications.markUnread({ workspaceSlug: slug, id: n.id }),
    target: (n) => n.id,
    change: (n) => ({ patch: (x) => ({ ...x, readAt: null }), unreadDelta: 1 - unreadOf(n) }),
    refetchLists: false,
    errorTitle: "Couldn't mark as unread",
  })
}

export function useMarkAllNotificationsRead(workspaceSlug: MaybeRefOrGetter<string>) {
  return useNotificationMutation(workspaceSlug, {
    mutationFn: (slug, _: void) => client.notifications.markAllRead({ workspaceSlug: slug }),
    target: () => null,
    // The count goes to zero; a large delta is clamped at 0.
    change: () => ({
      patch: (x) => ({ ...x, readAt: x.readAt ?? new Date() }),
      unreadDelta: -Number.MAX_SAFE_INTEGER,
    }),
    refetchLists: true,
    errorTitle: "Couldn't mark all as read",
  })
}

export function useArchiveNotification(workspaceSlug: MaybeRefOrGetter<string>) {
  return useNotificationMutation(workspaceSlug, {
    mutationFn: (slug, n: Notification) =>
      client.notifications.archive({ workspaceSlug: slug, id: n.id }),
    target: (n) => n.id,
    change: (n) => ({ patch: () => null, unreadDelta: -unreadOf(n) }),
    refetchLists: true,
    errorTitle: "Couldn't archive",
  })
}

export function useSnoozeNotification(workspaceSlug: MaybeRefOrGetter<string>) {
  return useNotificationMutation(workspaceSlug, {
    mutationFn: (slug, v: { notification: Notification; until: Date }) =>
      client.notifications.snooze({ workspaceSlug: slug, id: v.notification.id, until: v.until }),
    target: (v) => v.notification.id,
    change: (v) => ({ patch: () => null, unreadDelta: -unreadOf(v.notification) }),
    refetchLists: true,
    errorTitle: "Couldn't snooze",
  })
}
