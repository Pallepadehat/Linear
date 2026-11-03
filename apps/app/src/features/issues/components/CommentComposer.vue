<script setup lang="ts">
import { commentBodySchema } from '@linear/contract'
import { ArrowUp } from '@lucide/vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { onMounted, ref, useId, useTemplateRef } from 'vue'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/errors'
import { orpc } from '@/lib/orpc'
import { commentListOptions } from '../queries'

// The new-comment box under the timeline, or (with `parentId`) a thread's reply box,
// which focuses itself when opened and asks to collapse on Esc or after sending.
const props = defineProps<{
  workspaceSlug: string
  issueId: string
  parentId?: string
  placeholder?: string
  autofocus?: boolean
}>()
const emit = defineEmits<{ done: [] }>()

const id = useId()
const textarea = useTemplateRef<HTMLTextAreaElement>('textarea')
onMounted(() => {
  if (props.autofocus) textarea.value?.focus()
})

const queryClient = useQueryClient()
const body = ref('')
const error = ref<string | null>(null)

const create = useMutation(orpc.comments.create.mutationOptions())

async function submit() {
  const parsed = commentBodySchema.safeParse(body.value)
  if (!parsed.success) {
    error.value = body.value.trim() ? (parsed.error.issues[0]?.message ?? 'Invalid comment') : null
    return
  }
  error.value = null
  try {
    await create.mutateAsync({
      workspaceSlug: props.workspaceSlug,
      issueId: props.issueId,
      parentId: props.parentId,
      body: parsed.data,
    })
    body.value = ''
    emit('done')
    await queryClient.invalidateQueries({
      queryKey: commentListOptions(props.workspaceSlug, props.issueId).queryKey,
    })
  } catch (err) {
    error.value = errorMessage(err)
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
</script>

<template>
  <form
    novalidate
    class="rounded-lg border border-hairline bg-surface-1 px-4 pt-3 pb-2 focus-within:border-hairline-strong"
    @submit.prevent="submit"
  >
    <label :for="id" class="sr-only">{{ parentId ? 'Reply' : 'Leave a comment' }}</label>
    <textarea
      :id="id"
      ref="textarea"
      v-model="body"
      rows="2"
      :placeholder="placeholder ?? 'Leave a comment...'"
      :aria-invalid="Boolean(error)"
      :aria-describedby="error ? `${id}-error` : undefined"
      class="field-sizing-content max-h-80 min-h-10 w-full resize-none bg-transparent text-sm text-ink caret-primary outline-hidden placeholder:text-ink-tertiary"
      @keydown="onKeydown"
    />
    <div class="flex items-center gap-2">
      <p v-if="error" :id="`${id}-error`" class="text-[13px] text-danger" role="alert">
        {{ error }}
      </p>
      <Button
        type="submit"
        size="icon-sm"
        class="ml-auto"
        :disabled="!body.trim() || create.isPending.value"
        :aria-label="parentId ? 'Reply' : 'Comment'"
        :title="`${parentId ? 'Reply' : 'Comment'} (⌘↵)`"
        aria-keyshortcuts="Meta+Enter"
      >
        <ArrowUp aria-hidden="true" />
      </Button>
    </div>
  </form>
</template>
