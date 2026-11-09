<script setup lang="ts">
import { commentBodySchema } from '@linear/contract'
import { ArrowUp, Loader2, Paperclip } from '@lucide/vue'
import { computed, nextTick, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import IconButton from '@/components/common/IconButton.vue'
import MarkdownEditor from '@/components/common/editor/MarkdownEditor.vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTypingSignal } from '@/features/realtime/typing'
import { isMacPlatform } from '@/lib/hotkeys'
import { useCreateComment } from '../queries'

// The new-comment box under the timeline, or (with `parentId`) a thread's reply box,
// which focuses itself when opened and asks to collapse on Esc or after sending.
// One line at rest; grows with its content. Drafts survive reloads (per issue/thread),
// teammates see "… is typing" while you write, and the comment shows up at once.
const props = defineProps<{
  workspaceSlug: string
  issueId: string
  parentId?: string
  placeholder?: string
  autofocus?: boolean
}>()
const emit = defineEmits<{ done: [] }>()

const id = useId()
const editor = useTemplateRef<InstanceType<typeof MarkdownEditor>>('editor')
const form = useTemplateRef<HTMLFormElement>('form')
onMounted(async () => {
  if (!props.autofocus) return
  await nextTick()
  editor.value?.focus()
})

const mac = isMacPlatform()
const sendShortcut = '↵'
const newlineShortcut = mac ? '⇧↵' : 'Shift Enter'
const attachShortcut = mac ? '⌘⇧U' : 'Ctrl Shift U'

// ---------------------------------------------------------------- drafts
const draftKey = computed(() => `comment-draft:${props.issueId}:${props.parentId ?? 'root'}`)
function readDraft(key: string) {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}
function writeDraft(key: string, value: string) {
  try {
    if (value.trim()) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // Private mode or full storage: drafts just don't persist.
  }
}

const body = ref(readDraft(draftKey.value))
const error = ref<string | null>(null)
// J/K swaps the issue under a mounted composer: load that issue's draft.
watch(draftKey, (key) => {
  body.value = readDraft(key)
  error.value = null
})

const typing = useTypingSignal(
  () => props.workspaceSlug,
  () => props.issueId,
)
watch(body, (value) => {
  writeDraft(draftKey.value, value)
  if (value.trim()) typing.ping()
  else typing.stop()
})

// ---------------------------------------------------------------- send
const pendingUploads = computed(() => editor.value?.pendingUploads ?? 0)
const create = useCreateComment(
  () => props.workspaceSlug,
  () => props.issueId,
)

async function submit() {
  // Placeholders aren't real attachment references until their uploads finish.
  if (pendingUploads.value > 0) {
    error.value = 'Wait for attachments to finish uploading'
    return
  }
  const parsed = commentBodySchema.safeParse(body.value)
  if (!parsed.success) {
    error.value = body.value.trim() ? (parsed.error.issues[0]?.message ?? 'Invalid comment') : null
    return
  }
  error.value = null
  typing.stop()
  // Cleared at once (the comment is already in the timeline); restored if it fails.
  const sent = body.value
  const key = draftKey.value
  body.value = ''
  emit('done')
  try {
    await create.mutateAsync({ parentId: props.parentId, body: parsed.data })
  } catch {
    // The mutation's toast explains; the text comes back so nothing is lost.
    writeDraft(key, sent)
    if (draftKey.value === key && !body.value) body.value = sent
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    void submit()
  } else if (event.key === 'Escape' && props.parentId && !body.value.trim()) {
    event.preventDefault()
    emit('done')
  }
}

// Leaving the box (not just moving to its buttons) ends the "is typing" signal.
function onFocusOut(event: FocusEvent) {
  if (!form.value?.contains(event.relatedTarget as Node | null)) typing.stop()
}

watch(pendingUploads, (count) => {
  if (count === 0 && error.value === 'Wait for attachments to finish uploading') error.value = null
})
</script>

<template>
  <form
    ref="form"
    novalidate
    class="flex items-end gap-1 rounded-lg border border-hairline bg-surface-1 py-1 pr-1 pl-3 focus-within:border-hairline-strong"
    @submit.prevent="submit"
    @focusout="onFocusOut"
  >
    <div class="min-w-0 flex-1 py-1">
      <!-- Keys bubble up from the editor; open mention / slash menus stop Esc first. -->
      <div @keydown="onKeydown">
        <MarkdownEditor
          ref="editor"
          v-model="body"
          :label="parentId ? 'Reply' : 'Leave a comment'"
          :placeholder="placeholder ?? 'Leave a comment...'"
          :workspace-slug="workspaceSlug"
          submit-on-enter
          class="max-h-80 min-h-5 overflow-y-auto text-sm text-ink caret-primary"
          @submit="submit"
        />
      </div>
      <p v-if="error" :id="`${id}-error`" class="mt-1 text-xs text-danger" role="alert">
        {{ error }}
      </p>
      <p
        v-else-if="pendingUploads > 0"
        class="mt-1 flex items-center gap-1.5 text-xs text-ink-subtle"
        aria-live="polite"
      >
        <Loader2 class="size-3 animate-spin" aria-hidden="true" />
        Uploading {{ pendingUploads }} {{ pendingUploads === 1 ? 'file' : 'files' }}…
      </p>
    </div>
    <IconButton
      :icon="Paperclip"
      label="Attach files"
      :shortcut="attachShortcut"
      @click="editor?.pickFiles('files')"
    />
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          type="submit"
          size="icon-sm"
          class="shrink-0"
          :disabled="!body.trim() || pendingUploads > 0"
          :aria-label="parentId ? 'Reply' : 'Comment'"
          aria-keyshortcuts="Enter Meta+Enter"
        >
          <ArrowUp aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent class="flex items-center gap-2">
        {{ parentId ? 'Reply' : 'Comment' }}
        <kbd class="font-sans text-ink-subtle">{{ sendShortcut }}</kbd>
        <span class="text-ink-subtle">· New line</span>
        <kbd class="font-sans text-ink-subtle">{{ newlineShortcut }}</kbd>
      </TooltipContent>
    </Tooltip>
  </form>
</template>
