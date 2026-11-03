<script setup lang="ts">
import { commentBodySchema, type Comment, type ReactionEmoji } from '@linear/contract'
import { CircleCheck, Link, Pencil, Reply, RotateCcw, SmilePlus, Trash2 } from '@lucide/vue'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { toast } from 'vue-sonner'
import MarkdownEditor from '@/components/common/editor/MarkdownEditor.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { fullDate, timeAgo } from '@/lib/relative-time'
import { cn } from '@/lib/utils'
import { useCommentActions, useToggleReaction } from '../queries'
import CommentToolbarButton from './CommentToolbarButton.vue'
import EmojiPicker from './EmojiPicker.vue'

// One comment (a thread root or a reply): header, body, reaction pills and the
// hover toolbar. Roots also offer resolve/reopen; edit and delete are the author's.
const props = defineProps<{
  comment: Comment
  workspaceSlug: string
  issueId: string
  currentUserId: string | undefined
  /** Replies under a root, so deleting it can say what goes with it. */
  replyCount?: number
  highlighted?: boolean
}>()
const emit = defineEmits<{ reply: [] }>()

const isRoot = computed(() => props.comment.parentId === null)
const isAuthor = computed(() => props.comment.author.id === props.currentUserId)
const edited = computed(
  () => props.comment.updatedAt.getTime() !== props.comment.createdAt.getTime(),
)

const toggleReaction = useToggleReaction(
  () => props.workspaceSlug,
  () => props.issueId,
)
const actions = useCommentActions(
  () => props.workspaceSlug,
  () => props.issueId,
)

const pickerOpen = ref(false)
const pillPickerOpen = ref(false)
function react(emoji: ReactionEmoji) {
  const mine = props.comment.reactions.find((r) => r.emoji === emoji)?.reactedByMe ?? false
  toggleReaction.mutate({ comment: props.comment, emoji, on: !mine })
}

async function copyLink() {
  const url = new URL(window.location.href)
  url.hash = `comment-${props.comment.id}`
  try {
    await navigator.clipboard.writeText(url.toString())
    toast.success('Link copied to clipboard')
  } catch {
    toast.error("Couldn't copy the link")
  }
}

const editing = ref(false)
const draft = ref('')
const editError = ref<string | null>(null)
const editor = useTemplateRef<InstanceType<typeof MarkdownEditor>>('editor')
async function startEdit() {
  draft.value = props.comment.body
  editError.value = null
  editing.value = true
  await nextTick()
  editor.value?.focus()
}
async function saveEdit() {
  const parsed = commentBodySchema.safeParse(draft.value)
  if (!parsed.success) {
    editError.value = parsed.error.issues[0]?.message ?? 'Invalid comment'
    return
  }
  await actions.update.mutateAsync({
    workspaceSlug: props.workspaceSlug,
    id: props.comment.id,
    body: parsed.data,
  })
  editing.value = false
}
function onEditKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    void saveEdit().catch(() => {})
  } else if (event.key === 'Escape') {
    event.preventDefault()
    editing.value = false
  }
}

const confirmDelete = ref(false)
async function remove() {
  await actions.remove.mutateAsync({ workspaceSlug: props.workspaceSlug, id: props.comment.id })
  confirmDelete.value = false
}

function toggleResolved() {
  const input = { workspaceSlug: props.workspaceSlug, id: props.comment.id }
  if (props.comment.resolvedAt) actions.unresolve.mutate(input)
  else actions.resolve.mutate(input)
}
</script>

<template>
  <div
    :id="`comment-${comment.id}`"
    :class="
      cn(
        'group/comment relative scroll-mt-16 rounded-md px-3 py-2.5 transition-colors duration-700',
        highlighted && 'bg-surface-2',
      )
    "
  >
    <header class="flex items-center gap-2 pr-28 text-[13px]">
      <UserAvatar :name="comment.author.name" :src="comment.author.avatarUrl" size="sm" />
      <span class="font-medium text-ink">{{ comment.author.name }}</span>
      <a
        :href="`#comment-${comment.id}`"
        class="rounded-xs text-xs text-ink-subtle outline-none hover:text-ink-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <time :datetime="comment.createdAt.toISOString()" :title="fullDate(comment.createdAt)">
          {{ timeAgo(comment.createdAt) }}
        </time>
      </a>
      <span v-if="edited" class="text-xs text-ink-subtle" :title="fullDate(comment.updatedAt)">
        (edited)
      </span>
    </header>

    <div
      role="toolbar"
      :aria-label="`Actions for ${comment.author.name}'s comment`"
      :class="
        cn(
          'absolute top-1.5 right-2 flex items-center gap-0.5 rounded-full border border-hairline-strong bg-floating p-0.5 opacity-0 shadow-floating transition-opacity group-hover/comment:opacity-100 focus-within:opacity-100',
          (pickerOpen || editing) && 'opacity-100',
          editing && 'hidden',
        )
      "
    >
      <EmojiPicker v-model:open="pickerOpen" @pick="react">
        <CommentToolbarButton label="Add reaction" @click="pickerOpen = !pickerOpen">
          <SmilePlus aria-hidden="true" />
        </CommentToolbarButton>
      </EmojiPicker>
      <CommentToolbarButton label="Reply" aria-keyshortcuts="R" @click="emit('reply')">
        <Reply aria-hidden="true" />
      </CommentToolbarButton>
      <CommentToolbarButton
        v-if="isRoot"
        :label="comment.resolvedAt ? 'Reopen thread' : 'Resolve thread'"
        @click="toggleResolved"
      >
        <RotateCcw v-if="comment.resolvedAt" aria-hidden="true" />
        <CircleCheck v-else aria-hidden="true" />
      </CommentToolbarButton>
      <CommentToolbarButton label="Copy link" @click="copyLink">
        <Link aria-hidden="true" />
      </CommentToolbarButton>
      <template v-if="isAuthor">
        <CommentToolbarButton label="Edit" @click="startEdit">
          <Pencil aria-hidden="true" />
        </CommentToolbarButton>
        <CommentToolbarButton label="Delete" @click="confirmDelete = true">
          <Trash2 aria-hidden="true" />
        </CommentToolbarButton>
      </template>
    </div>

    <form
      v-if="editing"
      novalidate
      class="mt-2 ml-7 rounded-md border border-hairline-strong bg-canvas px-3 pt-2 pb-1.5"
      @submit.prevent="saveEdit().catch(() => {})"
    >
      <!-- Keys bubble up from the editor; open mention menus stop Esc first. -->
      <div @keydown="onEditKeydown">
        <MarkdownEditor
          ref="editor"
          v-model="draft"
          label="Edit comment"
          :workspace-slug="workspaceSlug"
          :attachments="false"
          class="max-h-80 min-h-10 overflow-y-auto text-sm text-ink caret-primary"
        />
      </div>
      <div class="flex items-center gap-2">
        <p v-if="editError" class="text-[13px] text-danger" role="alert">{{ editError }}</p>
        <Button type="button" variant="ghost" size="sm" class="ml-auto" @click="editing = false">
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          :disabled="!draft.trim() || actions.update.isPending.value"
          title="Save (⌘↵)"
        >
          Save
        </Button>
      </div>
    </form>
    <MarkdownEditor
      v-else
      :model-value="comment.body"
      readonly
      label="Comment"
      :workspace-slug="workspaceSlug"
      class="mt-1.5 pl-7 text-sm break-words text-ink"
    />

    <ul
      v-if="comment.reactions.length"
      class="mt-2 flex flex-wrap items-center gap-1.5 pl-7"
      aria-label="Reactions"
    >
      <li v-for="reaction in comment.reactions" :key="reaction.emoji">
        <button
          type="button"
          :aria-pressed="reaction.reactedByMe"
          :aria-label="`${reaction.emoji} ${reaction.count}, ${reaction.reactedByMe ? 'remove your reaction' : 'react'}`"
          :class="
            cn(
              'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs tabular-nums outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring',
              reaction.reactedByMe
                ? 'border-primary text-ink'
                : 'border-hairline bg-surface-1 text-ink-muted',
            )
          "
          @click="react(reaction.emoji)"
        >
          <span aria-hidden="true" class="text-[13px]">{{ reaction.emoji }}</span>
          <span aria-hidden="true">{{ reaction.count }}</span>
        </button>
      </li>
      <li>
        <EmojiPicker v-model:open="pillPickerOpen" @pick="react">
          <button
            type="button"
            aria-label="Add reaction"
            class="inline-flex h-6 items-center rounded-full border border-hairline bg-surface-1 px-2 text-ink-subtle outline-none hover:bg-surface-2 hover:text-ink-muted focus-visible:ring-2 focus-visible:ring-ring"
            @click="pillPickerOpen = !pillPickerOpen"
          >
            <SmilePlus class="size-3.5" aria-hidden="true" />
          </button>
        </EmojiPicker>
      </li>
    </ul>

    <Dialog v-model:open="confirmDelete">
      <DialogContent
        :show-close-button="false"
        class="gap-3 rounded-xl border-hairline bg-floating p-5 shadow-floating sm:max-w-md"
      >
        <DialogTitle class="text-[15px] font-medium text-ink">Delete comment?</DialogTitle>
        <DialogDescription class="text-[13px] text-ink-muted">
          {{
            isRoot && replyCount
              ? `This also deletes its ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}. This can't be undone.`
              : "This can't be undone."
          }}
        </DialogDescription>
        <DialogFooter class="flex-row justify-end gap-2">
          <DialogClose as-child>
            <Button type="button" variant="secondary" size="sm">Cancel</Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            :disabled="actions.remove.isPending.value"
            @click="remove().catch(() => {})"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
