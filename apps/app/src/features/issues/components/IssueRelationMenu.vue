<script setup lang="ts">
import type { Issue, IssueDetail } from '@linear/contract'
import { GitCompareArrows } from '@lucide/vue'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCreateRelation, type CreateRelationVariables } from '../queries'
import IssueSearchDialog from './IssueSearchDialog.vue'

// "Mark as" entry point. Lives in the properties sidebar until the detail
// header's "…" menu (M7-07) exists; it can move there as a submenu unchanged.
const props = defineProps<{ issue: IssueDetail; workspaceSlug: string }>()

type Kind = 'blockedBy' | 'blocking' | 'related' | 'duplicateOf'
const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'blockedBy', label: 'Blocked by…' },
  { kind: 'blocking', label: 'Blocking…' },
  { kind: 'related', label: 'Related to…' },
  { kind: 'duplicateOf', label: 'Duplicate of…' },
]

const picking = ref<Kind | null>(null)
const dialogOpen = computed({
  get: () => picking.value !== null,
  set: (open: boolean) => {
    if (!open) picking.value = null
  },
})
const dialogTitle = computed(
  () => KINDS.find((k) => k.kind === picking.value)?.label.replace('…', '') ?? '',
)

const createRelation = useCreateRelation(() => props.workspaceSlug)

// Stored directions: `blocks` runs from blocker to blocked, `duplicate` from the duplicate.
function variables(kind: Kind, self: string, other: string): CreateRelationVariables {
  switch (kind) {
    case 'blockedBy':
      return { issueId: other, relatedIssueId: self, type: 'blocks' }
    case 'blocking':
      return { issueId: self, relatedIssueId: other, type: 'blocks' }
    case 'related':
      return { issueId: self, relatedIssueId: other, type: 'related' }
    case 'duplicateOf':
      return { issueId: self, relatedIssueId: other, type: 'duplicate' }
  }
}

function relate(other: Issue) {
  const kind = picking.value
  if (kind) createRelation.mutate(variables(kind, props.issue.id, other.id))
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        class="justify-start rounded-full px-2 text-ink-subtle data-[state=open]:bg-surface-2 has-[>svg]:px-2"
      >
        <GitCompareArrows aria-hidden="true" />
        Mark as…
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-48 rounded-lg border-hairline bg-floating p-1.5">
      <DropdownMenuItem
        v-for="option in KINDS"
        :key="option.kind"
        class="h-8 rounded-md text-[13px]"
        @select="picking = option.kind"
      >
        {{ option.label }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  <IssueSearchDialog
    v-model:open="dialogOpen"
    :workspace-slug="workspaceSlug"
    :title="dialogTitle"
    :exclude-ids="[issue.id]"
    @select="relate"
  />
</template>
