<script setup lang="ts">
import type { Issue } from '@linear/contract'
import { useQuery } from '@tanstack/vue-query'
import { refDebounced } from '@vueuse/core'
import { ListboxContent, ListboxFilter, ListboxItem, ListboxRoot } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { issueSearchOptions } from '../queries'

// ⌘K-style issue picker: the server searches titles and identifiers; arrow keys
// move, Enter picks, Escape closes.
const props = defineProps<{
  workspaceSlug: string
  title: string
  /** Issues that can't be picked (the issue itself). */
  excludeIds: string[]
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ select: [issue: Issue] }>()

const search = ref('')
const q = refDebounced(search, 150)
watch(open, (isOpen) => {
  if (isOpen) search.value = ''
})

const query = useQuery(
  computed(() => ({
    ...issueSearchOptions(props.workspaceSlug, q.value.trim()),
    enabled: open.value,
  })),
)
const results = computed(
  () => query.data.value?.items.filter((issue) => !props.excludeIds.includes(issue.id)) ?? [],
)

function pick(issue: Issue) {
  emit('select', issue)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :show-close-button="false"
      class="top-[12%] translate-y-0 gap-0 overflow-hidden rounded-xl border-hairline bg-floating p-0 shadow-floating sm:max-w-xl"
    >
      <DialogTitle class="sr-only">{{ title }}</DialogTitle>
      <DialogDescription class="sr-only"
        >Search for an issue by title or identifier.</DialogDescription
      >
      <ListboxRoot highlight-on-hover class="flex flex-col">
        <div class="flex h-12 items-center gap-2 border-b border-hairline px-4">
          <span
            class="shrink-0 rounded-xs border border-hairline px-1.5 py-0.5 text-xs text-ink-subtle"
          >
            {{ title }}
          </span>
          <ListboxFilter
            v-model="search"
            auto-focus
            placeholder="Search issues…"
            aria-label="Search issues"
            class="h-full w-full bg-transparent text-sm text-ink caret-primary outline-hidden placeholder:text-ink-tertiary"
          />
        </div>
        <ListboxContent class="max-h-80 overflow-y-auto p-1.5">
          <p
            v-if="!results.length"
            class="px-2.5 py-4 text-center text-[13px] text-ink-subtle"
            role="status"
          >
            {{ query.isFetching.value ? 'Searching…' : 'No issues found' }}
          </p>
          <ListboxItem
            v-for="issue in results"
            :key="issue.id"
            :value="issue.id"
            class="flex h-9 cursor-default items-center gap-2.5 rounded-md px-2.5 text-[13px] text-ink outline-hidden data-[highlighted]:bg-floating-hover"
            @select.prevent="pick(issue)"
          >
            <StatusIcon :category="issue.status.category" />
            <span class="w-16 shrink-0 truncate font-mono text-xs text-ink-subtle">
              {{ issue.identifier }}
            </span>
            <span class="truncate">{{ issue.title }}</span>
          </ListboxItem>
        </ListboxContent>
      </ListboxRoot>
    </DialogContent>
  </Dialog>
</template>
