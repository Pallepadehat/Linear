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
  Link2,
  ListTree,
  Settings2,
  Sparkles,
  Star,
  StarOff,
  Trash2,
  Unlink,
  X,
} from '@lucide/vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watchEffect, type Component } from 'vue'
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
import { issueFacetsKey, issueListKey } from '../queries'
import { RELATION_KINDS, type RelationKind } from '../relation-kinds'

const props = defineProps<{
  workspaceSlug: string
  issue: IssueDetail
  /** The issue's team, once loaded: the breadcrumb and the fallback list (its issues). */
  teamName?: string
  teamKey?: string
}>()
// `setParent` opens the parent picker, which the page owns (it also answers ⇧⌘P);
// `markAs` opens the relation picker, `addLink` the link dialog (also Ctrl L).
const emit = defineEmits<{
  addLink: []
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
const COPY_ICONS: Record<CopyKind, Component> = {
  url: Link,
  id: Hash,
  branch: GitBranch,
  prompt: Sparkles,
}

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
const addLinkShortcut = shortcutKeys('issue-add-link')
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
  void queryClient.invalidateQueries({ queryKey: issueFacetsKey() })
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
</script>

<template>
  <Teleport defer :to="PANEL_HEADER_ACTIONS">
    <!-- One Copy menu instead of a row of unlabeled copy icons; shortcuts still work directly. -->
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="text-ink-muted data-[state=open]:bg-surface-2 max-md:size-7 max-md:px-0"
          aria-label="Copy"
        >
          <Copy aria-hidden="true" />
          <span class="max-md:hidden">Copy</span>
          <ChevronDown class="size-3 text-ink-subtle max-md:hidden" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-64">
        <DropdownMenuItem v-for="kind in copyKinds" :key="kind" @select="copy(kind)">
          <component :is="COPY_ICONS[kind]" aria-hidden="true" />
          {{ COPY_LABELS[kind] }}
          <DropdownMenuShortcut>{{ copyShortcut(kind) }}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem @select="configureCodingTools">
          <Settings2 aria-hidden="true" />
          Configure coding tools…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <div v-if="nav.position.value" class="flex items-center gap-0.5 max-md:hidden">
      <span class="px-1 text-xs text-ink-subtle tabular-nums" aria-live="polite">
        {{ nav.position.value.index }}
        <span class="text-ink-tertiary">/</span>
        {{ nav.position.value.total }}
      </span>
      <IconButton
        :icon="ChevronDown"
        label="Next issue"
        shortcut="J"
        :disabled="!nav.hasNext.value"
        @click="nav.next"
      />
      <IconButton
        :icon="ChevronUp"
        label="Previous issue"
        shortcut="K"
        :disabled="!nav.hasPrevious.value"
        @click="nav.previous"
      />
    </div>
    <!-- Page-level toggles (the subscribe bell) sit just before the actions menu. -->
    <slot />
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <IconButton
          :icon="Ellipsis"
          label="Issue actions"
          aria-haspopup="menu"
          class="data-[state=open]:bg-surface-2"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-56">
        <DropdownMenuSub v-if="removable.length">
          <DropdownMenuSubTrigger>
            <X aria-hidden="true" />
            Clear property
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent class="w-44">
            <DropdownMenuItem
              v-for="item in removable"
              :key="item.label"
              @select="emit('change', item.patch)"
            >
              {{ item.label }}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem @select="emit('setParent')">
          <ListTree aria-hidden="true" />
          Set parent issue…
          <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="issue.parentId"
          @select="emit('change', { parentId: null, parent: null })"
        >
          <Unlink aria-hidden="true" />
          Remove parent
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <GitCompareArrows aria-hidden="true" />
            Mark as
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent class="w-44">
            <DropdownMenuItem
              v-for="option in RELATION_KINDS"
              :key="option.kind"
              @select="emit('markAs', option.kind)"
            >
              {{ option.label }}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem @select="emit('addLink')">
          <Link2 aria-hidden="true" />
          Add link…
          <DropdownMenuShortcut>
            {{ addLinkShortcut }}
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem @select="toggleFavorite">
          <component :is="isFavorite ? StarOff : Star" aria-hidden="true" />
          {{ isFavorite ? 'Remove from favorites' : 'Add to favorites' }}
          <DropdownMenuShortcut>⌥F</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem @select="makeCopy">
          <CopyPlus aria-hidden="true" />
          Make a copy…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem @select="confirmingDelete = true">
          <Trash2 aria-hidden="true" />
          Delete
          <DropdownMenuShortcut>
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
