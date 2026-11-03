<script setup lang="ts">
import type { Issue } from '@linear/contract'
import { ChevronDown, ChevronUp, Copy, Ellipsis, Trash2, X } from '@lucide/vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { onKeyStroke } from '@vueuse/core'
import { computed, ref, watchEffect } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PANEL_HEADER_ACTIONS } from '@/layouts/panel-header'
import { errorMessage } from '@/lib/errors'
import { isTypingTarget } from '@/lib/keyboard'
import { orpc } from '@/lib/orpc'
import { useUiStore } from '@/stores/ui'
import { useIssueNav } from '../composables/useIssueNav'
import type { IssuePatch } from '../issue-cache'
import { issuePrefill } from '../prefill'
import { issueListKey } from '../queries'

const props = defineProps<{
  workspaceSlug: string
  issue: Issue
  /** The issue's team, once loaded: the breadcrumb and the fallback list (its issues). */
  teamName?: string
  teamKey?: string
}>()
const emit = defineEmits<{ change: [patch: IssuePatch] }>()

const ui = useUiStore()
const router = useRouter()
const queryClient = useQueryClient()
const nav = useIssueNav(() => props.issue.identifier)

/** The list the issue was opened from, else the team's issues, else all issues. */
const listRoute = computed<RouteLocationRaw>(
  () =>
    nav.sourceRoute.value ??
    (props.teamKey
      ? {
          name: 'team-issues',
          params: { workspaceSlug: props.workspaceSlug, teamKey: props.teamKey },
        }
      : { name: 'issues', params: { workspaceSlug: props.workspaceSlug } }),
)

// Team › Issues › TIP-200 Title, like Linear; "Issues" goes back to the list. After the
// layout's reset on navigation (J/K keeps this page mounted), hence `post` and the route.
watchEffect(
  () => {
    void router.currentRoute.value.path
    ui.breadcrumb = [
      ...(props.teamName
        ? [{ label: props.teamName, teamInitial: props.teamName.charAt(0).toUpperCase() }]
        : []),
      { label: 'Issues', to: listRoute.value },
      { label: props.issue.title, identifier: props.issue.identifier },
    ]
  },
  { flush: 'post' },
)

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const deleteShortcut = isMac ? '⌘⌫' : 'Ctrl ⌫'

// Only properties that are set can be removed; the submenu hides when none are.
type Removable = { label: string; patch: IssuePatch }
const removable = computed(() => {
  const items: Removable[] = []
  if (props.issue.assigneeId) items.push({ label: 'Assignee', patch: { assigneeId: null } })
  if (props.issue.projectId) items.push({ label: 'Project', patch: { projectId: null } })
  if (props.issue.labels.length) items.push({ label: 'All labels', patch: { labels: [] } })
  if (props.issue.priority > 0) items.push({ label: 'Priority', patch: { priority: 0 } })
  return items
})

// Like a template: the issue's title, description and properties (prefill.ts).
function makeCopy() {
  ui.openCreateIssue({ teamId: props.issue.teamId }, issuePrefill(props.issue))
}

const confirmingDelete = ref(false)
const deleteIssue = useMutation(orpc.issues.delete.mutationOptions())

async function confirmDelete() {
  const { identifier, id } = props.issue
  try {
    await deleteIssue.mutateAsync({ workspaceSlug: props.workspaceSlug, id })
  } catch (error) {
    toast.error(`Couldn't delete ${identifier}`, { description: errorMessage(error) })
    return
  }
  confirmingDelete.value = false
  toast.success(`${identifier} deleted`)
  await router.replace(listRoute.value)
  void queryClient.invalidateQueries({ queryKey: issueListKey() })
}

// ⌘⌫ (Ctrl+Backspace elsewhere) asks to delete, like Linear; not while typing.
onKeyStroke('Backspace', (event) => {
  if (!(isMac ? event.metaKey : event.ctrlKey) || isTypingTarget(event.target)) return
  event.preventDefault()
  confirmingDelete.value = true
})

const itemClass = 'h-8 rounded-md text-[13px]'
</script>

<template>
  <Teleport defer :to="PANEL_HEADER_ACTIONS">
    <div v-if="nav.position.value" class="flex items-center gap-0.5">
      <span class="px-1 text-xs text-ink-subtle tabular-nums" aria-live="polite">
        {{ nav.position.value.index }}
        <span class="text-ink-tertiary">/</span>
        {{ nav.position.value.total }}
      </span>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next issue"
            aria-keyshortcuts="J"
            :disabled="!nav.hasNext.value"
            @click="nav.next"
          >
            <ChevronDown aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Next issue <kbd class="ml-1 font-sans">J</kbd></TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous issue"
            aria-keyshortcuts="K"
            :disabled="!nav.hasPrevious.value"
            @click="nav.previous"
          >
            <ChevronUp aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Previous issue <kbd class="ml-1 font-sans">K</kbd></TooltipContent>
      </Tooltip>
    </div>
    <!-- Page-level toggles (the subscribe bell) sit just before the actions menu. -->
    <slot />
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Issue actions"
          class="data-[state=open]:bg-surface-2"
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-56 rounded-lg border-hairline bg-floating p-1.5">
        <DropdownMenuSub v-if="removable.length">
          <DropdownMenuSubTrigger :class="itemClass">
            <X class="text-ink-subtle" aria-hidden="true" />
            Remove
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent class="w-44 rounded-lg border-hairline bg-floating p-1.5">
            <DropdownMenuItem
              v-for="item in removable"
              :key="item.label"
              :class="itemClass"
              @select="emit('change', item.patch)"
            >
              {{ item.label }}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem :class="itemClass" @select="makeCopy">
          <Copy class="text-ink-subtle" aria-hidden="true" />
          Make a copy…
        </DropdownMenuItem>
        <DropdownMenuSeparator class="bg-hairline" />
        <DropdownMenuItem :class="itemClass" @select="confirmingDelete = true">
          <Trash2 class="text-ink-subtle" aria-hidden="true" />
          Delete
          <DropdownMenuShortcut class="tracking-normal text-ink-subtle">
            {{ deleteShortcut }}
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </Teleport>

  <Dialog v-model:open="confirmingDelete">
    <DialogContent
      :show-close-button="false"
      class="gap-3 rounded-xl border-hairline bg-floating p-4 shadow-floating sm:max-w-md"
    >
      <DialogTitle class="text-[15px] font-medium text-ink">Delete issue?</DialogTitle>
      <DialogDescription class="text-[13px] text-ink-muted">
        <span class="font-mono text-xs">{{ issue.identifier }}</span> {{ issue.title }} and its
        comments will be permanently deleted.
      </DialogDescription>
      <DialogFooter class="flex-row justify-end gap-2">
        <Button variant="secondary" size="sm" @click="confirmingDelete = false">Cancel</Button>
        <Button
          variant="destructive"
          size="sm"
          :disabled="deleteIssue.isPending.value"
          @click="confirmDelete"
        >
          Delete issue
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
