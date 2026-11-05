<script setup lang="ts">
import type { IssueDetail, IssueRelations } from '@linear/contract'
import { X } from '@lucide/vue'
import { computed } from 'vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import { useDeleteRelation } from '../queries'

const props = defineProps<{ issue: IssueDetail; workspaceSlug: string }>()

const GROUPS: { key: keyof IssueRelations; label: string }[] = [
  { key: 'blockedBy', label: 'Blocked by' },
  { key: 'blocks', label: 'Blocking' },
  { key: 'related', label: 'Related' },
  { key: 'duplicateOf', label: 'Duplicate of' },
  { key: 'duplicates', label: 'Duplicates' },
]
const groups = computed(() =>
  GROUPS.map((group) => ({ ...group, items: props.issue.relations[group.key] })).filter(
    (group) => group.items.length,
  ),
)

// Optimistic: the row disappears at once and comes back with a toast on failure.
const deleteRelation = useDeleteRelation(() => props.workspaceSlug)
</script>

<template>
  <section v-if="groups.length" aria-labelledby="relations-heading" class="mt-6 grid gap-3">
    <h2 id="relations-heading" class="sr-only">Related issues</h2>
    <div v-for="group in groups" :key="group.key" class="grid gap-0.5">
      <h3 class="px-2 text-xs font-medium text-ink-subtle">{{ group.label }}</h3>
      <ul class="grid">
        <li
          v-for="related in group.items"
          :key="related.relationId"
          class="group relative flex h-9 items-center gap-2.5 rounded-md px-2 text-[13px] hover:bg-surface-2 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring"
        >
          <StatusIcon :category="related.status.category" />
          <span class="sr-only">{{ related.status.name }}</span>
          <span class="w-16 shrink-0 truncate font-mono text-xs text-ink-subtle">
            {{ related.identifier }}
          </span>
          <RouterLink
            :to="{ name: 'issue', params: { identifier: related.identifier } }"
            class="min-w-0 flex-1 truncate text-ink outline-hidden after:absolute after:inset-0 after:content-['']"
          >
            {{ related.title }}
          </RouterLink>
          <button
            type="button"
            class="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-ink-subtle opacity-0 group-hover:opacity-100 hover:bg-surface-3 pointer-coarse:opacity-100 hover:text-ink focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
            :aria-label="`Remove relation with ${related.identifier}`"
            @click="deleteRelation.mutate(related.relationId)"
          >
            <X class="size-3.5" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>
