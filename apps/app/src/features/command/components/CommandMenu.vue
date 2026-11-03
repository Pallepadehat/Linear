<script setup lang="ts">
import type { Label } from '@linear/contract'
import {
  ArrowRight,
  CircleDashed,
  CircleUser,
  Copy,
  FolderKanban,
  FolderPlus,
  GitBranch,
  Inbox,
  Keyboard,
  Layers,
  Link,
  Monitor,
  Moon,
  SignalHigh,
  SquarePen,
  Sun,
  SunMoon,
  Tag,
  Trash2,
  UserRound,
} from '@lucide/vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { refDebounced, useClipboard } from '@vueuse/core'
import { computed, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import PickerItem from '@/components/common/PickerItem.vue'
import PriorityIcon from '@/components/common/PriorityIcon.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import UnassignedIcon from '@/components/common/UnassignedIcon.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { pickerShortcutsKey, type PickerShortcuts } from '@/components/common/picker-context'
import { Command, CommandEmpty, CommandGroup, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useTheme, type ThemeMode } from '@/composables/useTheme'
import { issueBranchName, issueUrl } from '@/features/issues/issue-links'
import { issueByIdentifierOptions, useUpdateIssue } from '@/features/issues/queries'
import type { IssuePatch } from '@/features/issues/issue-cache'
import { orpc } from '@/lib/orpc'
import { PRIORITIES } from '@/lib/priorities'
import { useUiStore } from '@/stores/ui'
import CommandMenuInput from './CommandMenuInput.vue'
import CommandMenuItem from './CommandMenuItem.vue'

type Page = 'root' | 'status' | 'priority' | 'assignee' | 'labels' | 'theme'

const PAGE_PLACEHOLDERS: Record<Page, string> = {
  root: 'Type a command or search...',
  status: 'Change status...',
  priority: 'Set priority to...',
  assignee: 'Assign to...',
  labels: 'Change labels...',
  theme: 'Change theme...',
}

const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const { slug } = useCurrentWorkspace()
const { mode: themeMode } = useTheme()
const { copy } = useClipboard({ legacy: true })

const open = computed({
  get: () => ui.commandMenuOpen,
  set: (value) => (ui.commandMenuOpen = value),
})
const page = ref<Page>('root')
const search = ref('')
watch(open, (isOpen) => {
  if (isOpen) page.value = 'root'
})

// Issue search runs on the server (identifier or title), debounced.
const term = refDebounced(
  computed(() => search.value.trim()),
  150,
)
const issueSearch = useQuery(
  computed(() => ({
    ...orpc.issues.list.queryOptions({
      input: { workspaceSlug: slug.value, q: term.value, limit: 10 },
    }),
    enabled: open.value && page.value === 'root' && term.value.length > 0,
    placeholderData: keepPreviousData,
  })),
)
const foundIssues = computed(() =>
  page.value === 'root' && search.value.trim() ? (issueSearch.data.value?.items ?? []) : [],
)

const { data: teams } = useQuery(
  computed(() => ({
    ...orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } }),
    enabled: open.value,
  })),
)

// The focused or open issue the actions apply to.
const activeIssueQuery = useQuery(
  computed(() => ({
    ...issueByIdentifierOptions(slug.value, ui.activeIssue?.identifier ?? ''),
    enabled: open.value && Boolean(ui.activeIssue),
  })),
)
const issue = computed(() =>
  ui.activeIssue && activeIssueQuery.data.value?.id === ui.activeIssue.id
    ? activeIssueQuery.data.value
    : undefined,
)
const issueTeam = computed(() => teams.value?.find((t) => t.id === issue.value?.teamId))
const { data: issueTeamDetail } = useQuery(
  computed(() => ({
    ...orpc.teams.get.queryOptions({
      input: { workspaceSlug: slug.value, key: issueTeam.value?.key ?? '' },
    }),
    enabled: open.value && Boolean(issueTeam.value),
  })),
)
const statuses = computed(() =>
  [...(issueTeamDetail.value?.statuses ?? [])].sort((a, b) => a.position - b.position),
)
const { data: members } = useQuery(
  computed(() => ({
    ...orpc.workspaces.listMembers.queryOptions({ input: { workspaceSlug: slug.value } }),
    enabled: open.value && Boolean(issue.value),
  })),
)
const { data: labels } = useQuery(
  computed(() => ({
    ...orpc.labels.list.queryOptions({ input: { workspaceSlug: slug.value } }),
    enabled: open.value && Boolean(issue.value),
  })),
)

// The team `G T` and "Go to team issues" mean: the page's team, else the issue's.
const currentTeamKey = computed(
  () => (route.params.teamKey as string | undefined) ?? issueTeam.value?.key,
)

const updateIssue = useUpdateIssue(slug)
function save(patch: IssuePatch) {
  if (issue.value) updateIssue.mutate({ issue: issue.value, patch })
}

function close() {
  open.value = false
}
function run(action: () => unknown) {
  close()
  void action()
}
function go(name: string, params: Record<string, string> = {}) {
  run(() => router.push({ name, params: { workspaceSlug: slug.value, ...params } }))
}
function toPage(next: Page) {
  page.value = next
}
function back() {
  page.value = 'root'
}
function onEscape(event: KeyboardEvent) {
  // Esc leaves a sub page first; only from the root page does it close the menu.
  if (page.value === 'root') return
  event.preventDefault()
  back()
}

async function copyText(text: string, what: string) {
  close()
  await copy(text)
  toast.success(`${what} copied`)
}

const origin = window.location.origin
function requestDelete() {
  const current = issue.value
  if (current) run(() => (ui.issueToDelete = { id: current.id, identifier: current.identifier }))
}

function setStatus(id: string) {
  const status = statuses.value.find((s) => s.id === id)
  if (status && issue.value && status.id !== issue.value.status.id) save({ status })
  close()
}
function setPriority(priority: number) {
  if (issue.value && priority !== issue.value.priority) save({ priority })
  close()
}
function setAssignee(assigneeId: string | null) {
  if (issue.value && assigneeId !== issue.value.assigneeId) save({ assigneeId })
  close()
}
// Multi-select: the page stays open while toggling, like the labels picker.
function toggleLabel(label: Label) {
  if (!issue.value) return
  const has = issue.value.labels.some((l) => l.id === label.id)
  save({
    labels: has
      ? issue.value.labels.filter((l) => l.id !== label.id)
      : [...issue.value.labels, label],
  })
}
function setTheme(mode: ThemeMode) {
  themeMode.value = mode
  close()
}

const users = computed(
  () => members.value?.map((m) => ({ id: m.userId, name: m.name, avatarUrl: m.avatarUrl })) ?? [],
)
const themes: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

// Number keys pick a row on the property pages, as in the pickers.
const shortcuts: PickerShortcuts = new Map()
provide(pickerShortcutsKey, shortcuts)
function onKeydown(event: KeyboardEvent) {
  if (page.value === 'root' || event.metaKey || event.ctrlKey || event.altKey) return
  if (search.value !== '') return
  const pick = shortcuts.get(event.key)
  if (!pick) return
  event.preventDefault()
  pick()
}

// The selected value on each property page starts highlighted.
const currentValue = computed(() => {
  if (!issue.value) return ''
  if (page.value === 'status') return issue.value.status.id
  if (page.value === 'priority') return String(issue.value.priority)
  if (page.value === 'assignee') return issue.value.assigneeId ?? 'unassigned'
  if (page.value === 'theme') return themeMode.value
  return ''
})
const context = computed(() =>
  issue.value ? `${issue.value.identifier} – ${issue.value.title}` : undefined,
)
const groupClass =
  'p-0 [&_[data-slot=command-group-heading]]:px-3 [&_[data-slot=command-group-heading]]:pt-2 [&_[data-slot=command-group-heading]]:text-xs [&_[data-slot=command-group-heading]]:font-normal [&_[data-slot=command-group-heading]]:text-ink-subtle'
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :show-close-button="false"
      class="top-[12%] translate-y-0 gap-0 overflow-hidden rounded-xl border-hairline bg-floating p-0 shadow-floating sm:max-w-2xl"
      @escape-key-down="onEscape"
    >
      <DialogTitle class="sr-only">Command menu</DialogTitle>
      <DialogDescription class="sr-only">
        Search issues, navigate, or run an action. Arrow keys move, Enter runs.
      </DialogDescription>
      <Command
        :key="page"
        :model-value="currentValue"
        class="rounded-none bg-transparent"
        @keydown="onKeydown"
      >
        <CommandMenuInput
          v-model:search="search"
          :placeholder="PAGE_PLACEHOLDERS[page]"
          :context="context"
          :results-key="foundIssues.map((i) => i.id).join()"
          @back="back"
        />
        <CommandList class="max-h-[min(60vh,420px)] p-2" aria-label="Commands">
          <CommandEmpty class="py-6 text-center text-[13px] text-ink-subtle">
            {{ issueSearch.isFetching.value ? 'Searching…' : 'No results' }}
          </CommandEmpty>

          <template v-if="page === 'root'">
            <CommandGroup v-if="foundIssues.length" heading="Issues" :class="groupClass">
              <CommandMenuItem
                v-for="found in foundIssues"
                :key="found.id"
                :value="`issue:${found.id}`"
                @select="go('issue', { identifier: found.identifier })"
              >
                <StatusIcon :category="found.status.category" />
                <span class="w-16 shrink-0 font-mono text-xs text-ink-subtle">
                  {{ found.identifier }}
                </span>
                <span class="truncate">{{ found.title }}</span>
              </CommandMenuItem>
            </CommandGroup>

            <CommandGroup v-if="issue" :heading="issue.identifier" :class="groupClass">
              <CommandMenuItem
                value="issue-status"
                :icon="CircleDashed"
                shortcut="issue-status"
                @select="toPage('status')"
              >
                Change status...
              </CommandMenuItem>
              <CommandMenuItem
                value="issue-priority"
                :icon="SignalHigh"
                shortcut="issue-priority"
                @select="toPage('priority')"
              >
                Change priority...
              </CommandMenuItem>
              <CommandMenuItem
                value="issue-assignee"
                :icon="UserRound"
                shortcut="issue-assignee"
                @select="toPage('assignee')"
              >
                Assign to...
              </CommandMenuItem>
              <CommandMenuItem
                value="issue-labels"
                :icon="Tag"
                shortcut="issue-labels"
                @select="toPage('labels')"
              >
                Change labels...
              </CommandMenuItem>
              <CommandMenuItem
                value="copy-id"
                :icon="Copy"
                @select="copyText(issue.identifier, 'Issue ID')"
              >
                Copy issue ID
              </CommandMenuItem>
              <CommandMenuItem
                value="copy-url"
                :icon="Link"
                @select="copyText(issueUrl(origin, slug, issue.identifier), 'Issue URL')"
              >
                Copy issue URL
              </CommandMenuItem>
              <CommandMenuItem
                value="copy-branch"
                :icon="GitBranch"
                @select="copyText(issueBranchName(issue.identifier, issue.title), 'Branch name')"
              >
                Copy git branch name
              </CommandMenuItem>
              <CommandMenuItem
                value="issue-delete"
                :icon="Trash2"
                shortcut="issue-delete"
                @select="requestDelete"
              >
                Delete issue...
              </CommandMenuItem>
            </CommandGroup>

            <CommandGroup heading="Create" :class="groupClass">
              <CommandMenuItem
                value="create-issue"
                :icon="SquarePen"
                shortcut="create-issue"
                @select="run(() => ui.openCreateIssue())"
              >
                Create new issue
              </CommandMenuItem>
              <CommandMenuItem
                value="create-project"
                :icon="FolderPlus"
                @select="run(() => (ui.createProjectOpen = true))"
              >
                Create new project
              </CommandMenuItem>
            </CommandGroup>

            <CommandGroup heading="Navigation" :class="groupClass">
              <CommandMenuItem
                value="go-inbox"
                :icon="Inbox"
                shortcut="go-inbox"
                @select="go('inbox')"
              >
                Go to Inbox
              </CommandMenuItem>
              <CommandMenuItem
                value="go-my-issues"
                :icon="CircleUser"
                shortcut="go-my-issues"
                @select="go('my-issues')"
              >
                Go to My issues
              </CommandMenuItem>
              <CommandMenuItem
                value="go-projects"
                :icon="FolderKanban"
                shortcut="go-projects"
                @select="go('projects')"
              >
                Go to Projects
              </CommandMenuItem>
              <CommandMenuItem value="go-all-issues" :icon="Layers" @select="go('issues')">
                Go to All issues
              </CommandMenuItem>
              <CommandMenuItem
                v-for="team in teams"
                :key="team.id"
                :value="`go-team:${team.id}`"
                :icon="ArrowRight"
                :shortcut="team.key === currentTeamKey ? 'go-team-issues' : undefined"
                @select="go('team-issues', { teamKey: team.key })"
              >
                Go to {{ team.name }} issues
              </CommandMenuItem>
            </CommandGroup>

            <CommandGroup heading="General" :class="groupClass">
              <CommandMenuItem value="theme" :icon="SunMoon" @select="toPage('theme')">
                Change theme...
              </CommandMenuItem>
              <CommandMenuItem
                value="shortcuts"
                :icon="Keyboard"
                shortcut="shortcuts-help"
                @select="run(() => (ui.shortcutsOpen = true))"
              >
                Keyboard shortcuts
              </CommandMenuItem>
            </CommandGroup>
          </template>

          <CommandGroup v-else-if="page === 'status'" :class="groupClass">
            <PickerItem
              v-for="(status, i) in statuses"
              :key="status.id"
              :value="status.id"
              :selected="status.id === issue?.status.id"
              :shortcut="i < 9 ? String(i + 1) : undefined"
              @select="setStatus(status.id)"
            >
              <StatusIcon :category="status.category" />
              {{ status.name }}
            </PickerItem>
          </CommandGroup>

          <CommandGroup v-else-if="page === 'priority'" :class="groupClass">
            <PickerItem
              v-for="priority in PRIORITIES"
              :key="priority.value"
              :value="String(priority.value)"
              :selected="priority.value === issue?.priority"
              :shortcut="String(priority.value)"
              @select="setPriority(priority.value)"
            >
              <PriorityIcon :priority="priority.value" />
              {{ priority.label }}
            </PickerItem>
          </CommandGroup>

          <CommandGroup v-else-if="page === 'assignee'" :class="groupClass">
            <PickerItem
              value="unassigned"
              :selected="issue?.assigneeId === null"
              shortcut="0"
              @select="setAssignee(null)"
            >
              <UnassignedIcon />
              No assignee
            </PickerItem>
            <PickerItem
              v-for="(user, i) in users"
              :key="user.id"
              :value="user.id"
              :selected="user.id === issue?.assigneeId"
              :shortcut="i < 9 ? String(i + 1) : undefined"
              @select="setAssignee(user.id)"
            >
              <UserAvatar :name="user.name" :src="user.avatarUrl" size="xs" />
              {{ user.name }}
            </PickerItem>
          </CommandGroup>

          <CommandGroup v-else-if="page === 'labels'" :class="groupClass">
            <PickerItem
              v-for="label in labels"
              :key="label.id"
              :value="label.id"
              :selected="issue?.labels.some((l) => l.id === label.id) ?? false"
              @select="toggleLabel(label)"
            >
              <span
                class="size-2 shrink-0 rounded-full bg-ink-tertiary"
                :style="label.color ? { backgroundColor: label.color } : undefined"
                aria-hidden="true"
              />
              {{ label.name }}
            </PickerItem>
          </CommandGroup>

          <CommandGroup v-else-if="page === 'theme'" :class="groupClass">
            <PickerItem
              v-for="theme in themes"
              :key="theme.value"
              :value="theme.value"
              :selected="theme.value === themeMode"
              @select="setTheme(theme.value)"
            >
              <component :is="theme.icon" class="size-4 text-ink-muted" aria-hidden="true" />
              {{ theme.label }}
            </PickerItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </DialogContent>
  </Dialog>
</template>
