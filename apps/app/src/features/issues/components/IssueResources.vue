<script setup lang="ts">
import type { IssueLink, LinkedPullRequest } from '@linear/contract'
import { Copy, Ellipsis, Link2, Pencil, Plus, X } from '@lucide/vue'
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import IconButton from '@/components/common/IconButton.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import PullRequestIcon from '@/features/github/components/PullRequestIcon.vue'
import { pullRequestStates } from '@/features/github/pull-requests'
import { useDeleteIssueLink } from '../queries'

// Web links and linked PRs in one list under the description (docs/domain.md → Links).
const props = defineProps<{
  workspaceSlug: string
  issueId: string
  links: IssueLink[]
  pullRequests: LinkedPullRequest[] | undefined
  /** "Ctrl L" or "⌃L", for the add button's tooltip. */
  addShortcut: string
}>()
const emit = defineEmits<{ add: []; edit: [link: IssueLink] }>()

const hasItems = computed(() => props.links.length > 0 || Boolean(props.pullRequests?.length))

async function copy(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    toast.success('Link copied to clipboard')
  } catch {
    toast.error("Couldn't copy the link")
  }
}

const deleteLink = useDeleteIssueLink(() => props.workspaceSlug)

const rowClass =
  'group relative flex h-9 items-center gap-2.5 rounded-md px-2 text-[13px] hover:bg-surface-2 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring'
const anchorClass =
  'min-w-0 shrink truncate text-ink outline-hidden after:absolute after:inset-0 after:content-[""]'
const actionsClass =
  'relative z-10 ml-auto flex shrink-0 items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 has-[[data-state=open]]:opacity-100 pointer-coarse:opacity-100'
const actionClass = 'size-6 [&_svg]:size-3.5'
</script>

<template>
  <section v-if="hasItems" aria-labelledby="resources-heading" class="mt-6 grid min-w-0 grid-cols-1 gap-0.5">
    <div class="flex h-7 items-center gap-2 px-2">
      <h2 id="resources-heading" class="text-xs font-medium text-ink-subtle">Resources</h2>
      <IconButton
        :icon="Plus"
        label="Add link"
        :shortcut="addShortcut"
        :class="actionClass"
        class="ml-auto"
        @click="emit('add')"
      />
    </div>
    <ul class="grid min-w-0 grid-cols-1">
      <li v-for="pr in pullRequests" :key="pr.id" :class="rowClass">
        <PullRequestIcon :state="pr.state" />
        <span class="sr-only">{{ pullRequestStates[pr.state].label }} pull request</span>
        <span class="shrink-0 font-mono text-xs text-ink-subtle">#{{ pr.number }}</span>
        <a :href="pr.url" target="_blank" rel="noopener noreferrer" :class="anchorClass">
          {{ pr.title }}
          <span class="sr-only">(opens in a new tab)</span>
        </a>
        <span class="min-w-0 shrink-[2] truncate text-xs text-ink-subtle">
          {{ pr.repoFullName }}
        </span>
        <span :class="actionsClass">
          <IconButton
            :icon="Copy"
            label="Copy link"
            :aria-label="`Copy link to #${pr.number}`"
            :class="actionClass"
            @click="copy(pr.url)"
          />
        </span>
      </li>
      <li v-for="link in links" :key="link.id" :class="rowClass">
        <!-- Generic icon: favicons would mean fetching from the linked site. -->
        <Link2 class="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
        <a :href="link.url" target="_blank" rel="noopener noreferrer" :class="anchorClass">
          {{ link.title }}
          <span class="sr-only">(opens in a new tab)</span>
        </a>
        <span
          v-if="link.title !== link.hostname"
          class="min-w-0 shrink-[2] truncate text-xs text-ink-subtle"
        >
          {{ link.hostname }}
        </span>
        <span :class="actionsClass">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <IconButton
                :icon="Ellipsis"
                label="Link actions"
                :aria-label="`Actions for link ${link.title}`"
                aria-haspopup="menu"
                :class="actionClass"
                class="data-[state=open]:bg-surface-3"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-44">
              <DropdownMenuItem @select="copy(link.url)">
                <Copy aria-hidden="true" />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem @select="emit('edit', link)">
                <Pencil aria-hidden="true" />
                Edit link…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem @select="deleteLink.mutate({ issueId, linkId: link.id })">
                <X aria-hidden="true" />
                Remove link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </li>
    </ul>
  </section>
</template>
