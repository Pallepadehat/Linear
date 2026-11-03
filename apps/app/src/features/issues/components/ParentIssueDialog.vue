<script setup lang="ts">
import type { Issue } from '@linear/contract'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { refDebounced } from '@vueuse/core'
import { ListboxContent, ListboxFilter, ListboxItem, ListboxRoot } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { orpc } from '@/lib/orpc'

// "Set parent issue…": searches the workspace by title or identifier. The server
// leaves out the issue and its descendants, so every option is a valid parent.
const props = defineProps<{
  workspaceSlug: string
  issueId: string
  currentParentId: string | null
}>()
const emit = defineEmits<{ select: [issue: Issue] }>()
const open = defineModel<boolean>('open', { required: true })

const search = ref('')
const q = refDebounced(search, 200)
watch(open, (value) => {
  if (value) search.value = ''
})

const { data, isFetching } = useQuery(
  computed(() => ({
    ...orpc.issues.list.queryOptions({
      input: {
        workspaceSlug: props.workspaceSlug,
        q: q.value.trim() || undefined,
        excludeSubtreeOf: props.issueId,
        sort: 'updatedAt',
        limit: 20,
      },
    }),
    enabled: open.value,
    placeholderData: keepPreviousData,
  })),
)
const options = computed(() => data.value?.items ?? [])

function choose(issue: Issue) {
  open.value = false
  if (issue.id !== props.currentParentId) emit('select', issue)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :show-close-button="false"
      class="top-[20%] translate-y-0 gap-0 overflow-hidden rounded-xl border-hairline bg-floating p-0 shadow-floating sm:max-w-lg"
    >
      <DialogTitle class="sr-only">Set parent issue</DialogTitle>
      <DialogDescription class="sr-only">
        Search for the issue to make this one a sub-issue of.
      </DialogDescription>
      <ListboxRoot class="flex flex-col" highlight-on-hover>
        <div class="flex h-11 items-center border-b border-hairline px-4">
          <ListboxFilter
            v-model="search"
            auto-focus
            placeholder="Set parent issue..."
            aria-label="Search issues"
            class="h-full w-full bg-transparent text-[13px] text-ink caret-primary outline-hidden placeholder:text-ink-tertiary"
          />
        </div>
        <ListboxContent class="max-h-80 overflow-y-auto p-1.5" :aria-busy="isFetching">
          <ListboxItem
            v-for="option in options"
            :key="option.id"
            :value="option.id"
            class="flex h-8 cursor-default items-center gap-2.5 rounded-md px-2.5 text-[13px] text-ink outline-hidden data-[highlighted]:bg-floating-hover"
            @select="choose(option)"
          >
            <StatusIcon :category="option.status.category" />
            <span class="w-16 shrink-0 font-mono text-xs text-ink-subtle">
              {{ option.identifier }}
            </span>
            <span class="truncate">{{ option.title }}</span>
          </ListboxItem>
          <p v-if="!options.length && !isFetching" class="py-4 text-center text-ink-subtle">
            No issues found
          </p>
        </ListboxContent>
      </ListboxRoot>
    </DialogContent>
  </Dialog>
</template>
