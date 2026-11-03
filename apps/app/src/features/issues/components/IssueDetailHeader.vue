<script setup lang="ts">
import type { IssueDetail } from '@linear/contract'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  CopyPlus,
  Ellipsis,
  GitBranch,
  GitCompareArrows,
  Hash,
  Link,
  ListTree,
  Star,
  StarOff,
  Trash2,
  Unlink,
  X,
} from '@lucide/vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watchEffect } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { toast } from 'vue-sonner'
import IconButton from '@/components/common/IconButton.vue'
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
import { useToggleFavorite } from '@/features/favorites/queries'
import { errorMessage } from '@/lib/errors'
import { useHotkeys } from '@/composables/useHotkeys'
import { isMacPlatform, shortcutKeys } from '@/lib/hotkeys'
import { orpc } from '@/lib/orpc'
import { useUiStore } from '@/stores/ui'
import { useIssueCopy } from '../composables/useIssueCopy'
import { COPY_LABELS, copyShortcut, type CopyKind } from '../copy-shortcuts'
import { useIssueNav } from '../composables/useIssueNav'
import type { IssuePatch } from '../issue-cache'
import { issuePrefill } from '../prefill'
import { issueListKey } from '../queries'
import { RELATION_KINDS, type RelationKind } from '../relation-kinds'

const props = defineProps<{
  workspaceSlug: string
  issue: IssueDetail
  /** The issue's team, once loaded: the breadcrumb and the fallback list (its issues). */
  teamName?: string
  teamKey?: string
}>()
// `setParent` opens the parent picker, which the page owns (it also answers ⇧⌘P);
// `markAs` opens the relation picker.
const emit = defineEmits<{
  change: [patch: IssuePatch]
  setParent: []
  markAs: [kind: RelationKind]
}>()

const ui = useUiStore()
const router = useRouter()
const queryClient = useQueryClient()
const nav = useIssueNav(() => props.issue.identifier)
const { copy } = useIssueCopy(() => props.issue)
const copyKinds: CopyKind[] = ['url', 'id', 'branch', 'prompt']

// Coding tool integrations aren't built yet; the settings section says so.
function configureCodingTools() {
  void router.push({
    name: 'settings',
    params: { workspaceSlug: props.workspaceSlug },
    hash: '#coding-tools',
  })
}

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
    // The header star and ⌥F act on this issue (M8-07).
    ui.favoriteTarget = {
      entityType: 'issue',
      entityId: props.issue.id,
      identifier: props.issue.identifier,
      title: props.issue.title,
      statusCategory: props.issue.status.category,
    }
  },
  { flush: 'post' },
)

// From the shortcut catalog, so the menu hint matches the binding.
const deleteShortcut = shortcutKeys('issue-delete')
  .flat()
  .join(isMacPlatform() ? '' : ' ')

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
useHotkeys([{ id: 'issue-delete', run: () => void (confirmingDelete.value = true) }])

const favorites = useToggleFavorite(() => props.workspaceSlug)
const isFavorite = computed(() =>
  favorites.isFavorite({ entityType: 'issue', entityId: props.issue.id }),
)
function toggleFavorite() {
  if (ui.favoriteTarget?.entityId === props.issue.id) favorites.toggle(ui.favoriteTarget)
}

const itemClass = 'h-8 rounded-md text-[13px]'
</script>

<template>
  <Teleport defer :to="PANEL_HEADER_ACTIONS">
    <div class="flex items-center gap-0.5">
      <IconButton
        :icon="Link"
        :label="COPY_LABELS.url"
        :shortcut="copyShortcut('url')"
        @click="copy('url')"
      />
      <IconButton
        :icon="Hash"
        :label="COPY_LABELS.id"
        :shortcut="copyShortcut('id')"
        @click="copy('id')"
      />
      <IconButton
        :icon="GitBranch"
        :label="COPY_LABELS.branch"
        :shortcut="copyShortcut('branch')"
        @click="copy('branch')"
      />
    </div>
    <div class="flex items-center rounded-full border border-hairline">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="sm"
            class="h-[26px] rounded-r-none pr-2 pl-3"
            :aria-keyshortcuts="copyShortcut('prompt')"
            @click="copy('prompt')"
          >
            {{ COPY_LABELS.prompt }}
          </Button>
        </TooltipTrigger>
        <TooltipContent class="flex items-center gap-2">
          Copy issue as a prompt for a coding agent
          <kbd class="font-sans text-ink-subtle">{{ copyShortcut('prompt') }}</kbd>
        </TooltipContent>
      </Tooltip>
      <span class="h-3.5 w-px bg-hairline" aria-hidden="true" />
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Copy as prompt options"
            class="h-[26px] w-6 rounded-l-none data-[state=open]:bg-surface-2"
          >
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-56 rounded-lg border-hairline bg-floating p-1.5">
          <DropdownMenuItem :class="itemClass" @select="copy('prompt')">
            {{ COPY_LABELS.prompt }}
            <DropdownMenuShortcut class="tracking-normal text-ink-subtle">
              {{ copyShortcut('prompt') }}
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem :class="itemClass" @select="configureCodingTools">
            Configure coding tools…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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
        <DropdownMenuItem :class="itemClass" @select="emit('setParent')">
          <ListTree class="text-ink-subtle" aria-hidden="true" />
          Set parent issue…
          <DropdownMenuShortcut class="tracking-normal text-ink-subtle">⇧⌘P</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="issue.parentId"
          :class="itemClass"
          @select="emit('change', { parentId: null, parent: null })"
        >
          <Unlink class="text-ink-subtle" aria-hidden="true" />
          Remove parent
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger :class="itemClass">
            <GitCompareArrows class="text-ink-subtle" aria-hidden="true" />
            Mark as
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent class="w-44 rounded-lg border-hairline bg-floating p-1.5">
            <DropdownMenuItem
              v-for="option in RELATION_KINDS"
              :key="option.kind"
              :class="itemClass"
              @select="emit('markAs', option.kind)"
            >
              {{ option.label }}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem :class="itemClass" @select="toggleFavorite">
          <component :is="isFavorite ? StarOff : Star" class="text-ink-subtle" aria-hidden="true" />
          {{ isFavorite ? 'Remove from favorites' : 'Add to favorites' }}
          <DropdownMenuShortcut class="tracking-normal text-ink-subtle">⌥F</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger :class="itemClass">
            <Copy class="text-ink-subtle" aria-hidden="true" />
            Copy
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent class="w-60 rounded-lg border-hairline bg-floating p-1.5">
            <DropdownMenuItem
              v-for="kind in copyKinds"
              :key="kind"
              :class="itemClass"
              @select="copy(kind)"
            >
              {{ COPY_LABELS[kind] }}
              <DropdownMenuShortcut class="tracking-normal text-ink-subtle">
                {{ copyShortcut(kind) }}
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem :class="itemClass" @select="makeCopy">
          <CopyPlus class="text-ink-subtle" aria-hidden="true" />
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
