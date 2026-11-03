<script setup lang="ts">
import type { CommentThread } from '@linear/contract'
import { CircleCheck, ChevronRight } from '@lucide/vue'
import { useEventListener } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'
import CommentComposer from './CommentComposer.vue'
import CommentItem from './CommentItem.vue'

// A root comment with its replies indented below and a collapsed "Reply…" box
// (click or R while the thread is hovered or focused). A resolved thread folds into
// a one-line summary until expanded; linking to a comment inside it expands it.
const props = defineProps<{
  thread: CommentThread
  workspaceSlug: string
  issueId: string
  currentUserId: string | undefined
  highlightId: string | null
}>()

const containsHighlight = computed(
  () =>
    props.highlightId !== null &&
    (props.thread.id === props.highlightId ||
      props.thread.replies.some((r) => r.id === props.highlightId)),
)
const expanded = ref(false)
watch(
  containsHighlight,
  (contains) => {
    if (contains) expanded.value = true
  },
  { immediate: true },
)
// Folding back up when someone resolves the thread.
watch(
  () => props.thread.resolvedAt,
  (resolvedAt) => {
    if (resolvedAt && !containsHighlight.value) expanded.value = false
  },
)
const collapsed = computed(() => Boolean(props.thread.resolvedAt) && !expanded.value)

const replying = ref(false)
function reply() {
  expanded.value = true
  replying.value = true
}

const root = useTemplateRef<HTMLElement>('root')
useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (event.key.toLowerCase() !== 'r' || event.defaultPrevented) return
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
  const target = event.target
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select, [role="dialog"]'))
  )
    return
  const el = root.value
  if (!el || !(el.matches(':hover') || el.contains(document.activeElement))) return
  event.preventDefault()
  reply()
})

const hiddenReplies = computed(() => props.thread.replyCount - props.thread.replies.length)
const repliesLabel = computed(
  () => `${props.thread.replyCount} ${props.thread.replyCount === 1 ? 'reply' : 'replies'}`,
)
</script>

<template>
  <article
    ref="root"
    class="rounded-lg border border-hairline bg-surface-1"
    :aria-label="`Comment thread by ${thread.author.name}`"
  >
    <button
      v-if="collapsed"
      type="button"
      class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] text-ink-subtle outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
      :aria-expanded="false"
      @click="expanded = true"
    >
      <CircleCheck class="size-3.5 shrink-0" aria-hidden="true" />
      <span class="shrink-0 font-medium text-ink-muted">Resolved thread</span>
      <span aria-hidden="true">·</span>
      <span class="shrink-0">{{ repliesLabel }}</span>
      <span class="min-w-0 truncate">— {{ thread.author.name }}: {{ thread.body }}</span>
      <ChevronRight class="ml-auto size-3.5 shrink-0" aria-hidden="true" />
    </button>

    <template v-else>
      <button
        v-if="thread.resolvedAt"
        type="button"
        class="flex w-full items-center gap-2 border-b border-hairline px-3 py-1.5 text-left text-xs text-ink-subtle outline-none hover:text-ink-muted focus-visible:ring-2 focus-visible:ring-ring"
        :aria-expanded="true"
        @click="expanded = false"
      >
        <CircleCheck class="size-3.5" aria-hidden="true" />
        Resolved thread · Collapse
      </button>
      <div class="p-1">
        <CommentItem
          :comment="thread"
          :workspace-slug="workspaceSlug"
          :issue-id="issueId"
          :current-user-id="currentUserId"
          :reply-count="thread.replyCount"
          :highlighted="highlightId === thread.id"
          @reply="reply"
        />
        <ol v-if="thread.replies.length" class="ml-7 grid" aria-label="Replies">
          <li v-for="r in thread.replies" :key="r.id">
            <CommentItem
              :comment="r"
              :workspace-slug="workspaceSlug"
              :issue-id="issueId"
              :current-user-id="currentUserId"
              :highlighted="highlightId === r.id"
              @reply="reply"
            />
          </li>
        </ol>
        <p v-if="hiddenReplies > 0" class="ml-10 px-3 py-1 text-xs text-ink-subtle">
          {{ hiddenReplies }} more {{ hiddenReplies === 1 ? 'reply' : 'replies' }} not shown
        </p>
        <div class="ml-10 px-2 pt-1 pb-2">
          <CommentComposer
            v-if="replying"
            :workspace-slug="workspaceSlug"
            :issue-id="issueId"
            :parent-id="thread.id"
            placeholder="Leave a reply..."
            autofocus
            @done="replying = false"
          />
          <button
            v-else
            type="button"
            aria-keyshortcuts="R"
            class="h-8 w-full rounded-md px-3 text-left text-[13px] text-ink-tertiary outline-none hover:bg-surface-2 hover:text-ink-subtle focus-visible:ring-2 focus-visible:ring-ring"
            @click="reply"
          >
            Reply…
          </button>
        </div>
      </div>
    </template>
  </article>
</template>
