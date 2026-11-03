import type { Comment, CommentReaction, CommentsPage, ReactionEmoji } from '@linear/contract'
import type { InfiniteData } from '@tanstack/vue-query'

/** My reactions with `emoji` added or removed; a pill that drops to zero disappears. */
export function toggleReaction(
  reactions: CommentReaction[],
  emoji: ReactionEmoji,
  on: boolean,
): CommentReaction[] {
  const existing = reactions.find((r) => r.emoji === emoji)
  if (on) {
    if (existing?.reactedByMe) return reactions
    if (!existing) return [...reactions, { emoji, count: 1, reactedByMe: true }]
    return reactions.map((r) =>
      r === existing ? { ...r, count: r.count + 1, reactedByMe: true } : r,
    )
  }
  if (!existing?.reactedByMe) return reactions
  if (existing.count <= 1) return reactions.filter((r) => r !== existing)
  return reactions.map((r) =>
    r === existing ? { ...r, count: r.count - 1, reactedByMe: false } : r,
  )
}

/** Applies `update` to the comment with `id` — a thread root or a reply — in every page. */
export function patchCommentInPages<P>(
  data: InfiniteData<CommentsPage, P> | undefined,
  id: string,
  update: <C extends Comment>(comment: C) => C,
): InfiniteData<CommentsPage, P> | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((thread) => {
        if (thread.id === id) return update(thread)
        if (!thread.replies.some((r) => r.id === id)) return thread
        return { ...thread, replies: thread.replies.map((r) => (r.id === id ? update(r) : r)) }
      }),
    })),
  }
}
