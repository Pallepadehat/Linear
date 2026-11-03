<script setup lang="ts">
import { projectUpdateBodySchema } from '@linear/contract'
import { nextTick, onMounted, ref, useTemplateRef } from 'vue'
import MarkdownEditor from '@/components/common/editor/MarkdownEditor.vue'
import { Button } from '@/components/ui/button'
import type { HealthValue } from '../project-health'
import { useProjectUpdateActions } from '../queries'
import ProjectHealthPicker from './ProjectHealthPicker.vue'

// Writes a new project update, or (with `updateId`) edits one in place. Posting sets
// the project's health; ⌘↵ posts and Esc cancels.
const props = withDefaults(
  defineProps<{
    workspaceSlug: string
    projectId: string
    updateId?: string
    initialHealth?: HealthValue
    initialBody?: string
  }>(),
  { updateId: undefined, initialHealth: 'on_track', initialBody: '' },
)
const emit = defineEmits<{ done: [] }>()

const health = ref<HealthValue>(props.initialHealth)
const body = ref(props.initialBody)
const error = ref<string | null>(null)
const actions = useProjectUpdateActions()
const pending = () => actions.create.isPending.value || actions.update.isPending.value

const editor = useTemplateRef<InstanceType<typeof MarkdownEditor>>('editor')
onMounted(async () => {
  await nextTick()
  editor.value?.focus()
})

async function submit() {
  const parsed = projectUpdateBodySchema.safeParse(body.value)
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? 'Invalid update'
    return
  }
  error.value = null
  const input = { workspaceSlug: props.workspaceSlug, health: health.value, body: parsed.data }
  try {
    if (props.updateId) await actions.update.mutateAsync({ ...input, id: props.updateId })
    else await actions.create.mutateAsync({ ...input, projectId: props.projectId })
    emit('done')
  } catch {
    // The mutation's toast reports it; the draft stays so nothing is lost.
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    void submit()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    emit('done')
  }
}
</script>

<template>
  <form
    novalidate
    :aria-label="updateId ? 'Edit project update' : 'New project update'"
    class="grid gap-2 rounded-lg border border-hairline bg-surface-1 px-4 pt-3 pb-2 focus-within:border-hairline-strong"
    @submit.prevent="submit"
  >
    <div class="w-fit [&_button]:border [&_button]:border-hairline">
      <ProjectHealthPicker v-model="health" />
    </div>
    <!-- Keys bubble up from the editor; open mention / slash menus stop Esc first. -->
    <div @keydown="onKeydown">
      <MarkdownEditor
        ref="editor"
        v-model="body"
        label="Update"
        placeholder="Write an update on progress, risks and next steps..."
        :workspace-slug="workspaceSlug"
        :attachments="false"
        class="max-h-96 min-h-16 overflow-y-auto text-sm text-ink caret-primary"
      />
    </div>
    <div class="flex items-center gap-2">
      <p v-if="error" class="text-[13px] text-danger" role="alert">{{ error }}</p>
      <Button type="button" variant="ghost" size="sm" class="ml-auto" @click="emit('done')">
        Cancel
      </Button>
      <Button type="submit" size="sm" :disabled="!body.trim() || pending()" title="Post (⌘↵)">
        {{ updateId ? 'Save' : 'Post' }}
      </Button>
    </div>
  </form>
</template>
