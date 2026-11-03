<script setup lang="ts">
import { Ellipsis, Pencil, Trash2 } from '@lucide/vue'
import { computed, ref } from 'vue'
import MarkdownEditor from '@/components/common/editor/MarkdownEditor.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { fullDate, timeAgo } from '@/lib/relative-time'
import { healthLabel, type HealthValue } from '../project-health'
import { useProjectUpdateActions } from '../queries'
import HealthIcon from './HealthIcon.vue'
import ProjectUpdateComposer from './ProjectUpdateComposer.vue'

// One project update: author, health chip, time and body, with "…" → Edit (author)
// and Delete (author or workspace owner; the server checks both).
const props = defineProps<{
  workspaceSlug: string
  projectId: string
  id: string
  authorName: string
  authorAvatarUrl: string | null
  health: HealthValue
  body: string
  createdAt: Date
  updatedAt: Date
  canEdit: boolean
  canDelete: boolean
}>()

const edited = computed(() => props.updatedAt.getTime() !== props.createdAt.getTime())
const editing = ref(false)
const confirmDelete = ref(false)
const actions = useProjectUpdateActions()

async function remove() {
  await actions.remove.mutateAsync({ workspaceSlug: props.workspaceSlug, id: props.id })
  confirmDelete.value = false
}
</script>

<template>
  <ProjectUpdateComposer
    v-if="editing"
    :workspace-slug="workspaceSlug"
    :project-id="projectId"
    :update-id="id"
    :initial-health="health"
    :initial-body="body"
    @done="editing = false"
  />
  <article
    v-else
    :aria-label="`Update by ${authorName}`"
    class="group/update grid gap-2 rounded-lg border border-hairline bg-surface-1 px-4 py-3"
  >
    <header class="flex items-center gap-2 text-[13px]">
      <span
        class="flex h-6 items-center gap-1.5 rounded-full border border-hairline px-2 text-xs font-medium text-ink"
      >
        <HealthIcon :health="health" />
        {{ healthLabel(health) }}
      </span>
      <UserAvatar :name="authorName" :src="authorAvatarUrl" size="sm" />
      <span class="font-medium text-ink">{{ authorName }}</span>
      <time
        :datetime="createdAt.toISOString()"
        :title="fullDate(createdAt)"
        class="text-xs text-ink-subtle"
      >
        {{ timeAgo(createdAt) }}
      </time>
      <span v-if="edited" class="text-xs text-ink-subtle" :title="fullDate(updatedAt)">
        (edited)
      </span>
      <DropdownMenu v-if="canEdit || canDelete">
        <DropdownMenuTrigger
          class="ml-auto flex size-6 shrink-0 items-center justify-center rounded-full text-ink-subtle opacity-0 outline-hidden group-focus-within/update:opacity-100 group-hover/update:opacity-100 hover:bg-surface-3 hover:text-ink focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:opacity-100"
          aria-label="Update options"
        >
          <Ellipsis class="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-44">
          <DropdownMenuItem v-if="canEdit" @select="editing = true">
            <Pencil class="size-4" aria-hidden="true" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem v-if="canDelete" @select="confirmDelete = true">
            <Trash2 class="size-4" aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
    <MarkdownEditor
      :model-value="body"
      readonly
      label="Update"
      :workspace-slug="workspaceSlug"
      class="text-sm break-words text-ink"
    />

    <Dialog v-model:open="confirmDelete">
      <DialogContent
        :show-close-button="false"
        class="gap-3 rounded-xl border-hairline bg-floating p-5 shadow-floating sm:max-w-md"
      >
        <DialogTitle class="text-[15px] font-medium text-ink">Delete update?</DialogTitle>
        <DialogDescription class="text-[13px] text-ink-muted">
          The project's health goes back to the previous update. This can't be undone.
        </DialogDescription>
        <DialogFooter class="flex-row justify-end gap-2">
          <DialogClose as-child>
            <Button type="button" variant="secondary" size="sm">Cancel</Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            :disabled="actions.remove.isPending.value"
            @click="remove().catch(() => {})"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </article>
</template>
