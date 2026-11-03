<script setup lang="ts">
import { commentBodySchema } from '@linear/contract'
import { ArrowUp } from '@lucide/vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/errors'
import { orpc } from '@/lib/orpc'
import { commentListOptions, issueDetailKeys, issueSubscribersOptions } from '../queries'

const props = defineProps<{ workspaceSlug: string; issueId: string }>()

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
      body: parsed.data,
    })
    body.value = ''
    // Commenting subscribes the author, so the bell and subscriber list change too.
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: commentListOptions(props.workspaceSlug, props.issueId).queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: issueSubscribersOptions(props.workspaceSlug, props.issueId).queryKey,
      }),
      ...issueDetailKeys().map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    ])
  } catch (err) {
    error.value = errorMessage(err)
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    void submit()
  }
}
</script>

<template>
  <form
    novalidate
    class="rounded-lg border border-hairline bg-surface-1 px-4 pt-3 pb-2 focus-within:border-hairline-strong"
    @submit.prevent="submit"
  >
    <label for="new-comment" class="sr-only">Leave a comment</label>
    <textarea
      id="new-comment"
      v-model="body"
      rows="2"
      placeholder="Leave a comment..."
      :aria-invalid="Boolean(error)"
      :aria-describedby="error ? 'new-comment-error' : undefined"
      class="field-sizing-content max-h-80 min-h-10 w-full resize-none bg-transparent text-sm text-ink caret-primary outline-hidden placeholder:text-ink-tertiary"
      @keydown="onKeydown"
    />
    <div class="flex items-center gap-2">
      <p v-if="error" id="new-comment-error" class="text-[13px] text-danger" role="alert">
        {{ error }}
      </p>
      <Button
        type="submit"
        size="icon-sm"
        class="ml-auto"
        :disabled="!body.trim() || create.isPending.value"
        aria-label="Comment"
        title="Comment (⌘↵)"
        aria-keyshortcuts="Meta+Enter"
      >
        <ArrowUp aria-hidden="true" />
      </Button>
    </div>
  </form>
</template>
