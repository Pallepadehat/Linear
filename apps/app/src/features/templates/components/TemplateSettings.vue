<script setup lang="ts">
import type { IssueTemplate } from '@linear/contract'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { LayoutTemplate, Pencil, Plus, Trash2 } from '@lucide/vue'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { errorMessage } from '@/lib/errors'
import { client, orpc } from '@/lib/orpc'
import { templateListOptions, templatesKey } from '../queries'
import TemplateFormDialog from './TemplateFormDialog.vue'

// Workspace settings list workspace templates; a team's settings add the team's own.
// Any member may manage them (docs/domain.md → Templates).
const props = defineProps<{ teamId?: string }>()

const queryClient = useQueryClient()
const { slug } = useCurrentWorkspace()
const { data: templates, isPending } = useQuery(
  computed(() => templateListOptions(slug.value, props.teamId)),
)
const { data: teams } = useQuery(
  computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)
const scopeName = (template: IssueTemplate) =>
  template.teamId
    ? (teams.value?.find((t) => t.id === template.teamId)?.name ?? 'Team')
    : 'Workspace'

const formOpen = ref(false)
const editing = ref<IssueTemplate | null>(null)
function openForm(template: IssueTemplate | null) {
  editing.value = template
  formOpen.value = true
}

const deleting = ref<IssueTemplate | null>(null)
const confirmOpen = computed({
  get: () => deleting.value !== null,
  set: (open: boolean) => {
    if (!open) deleting.value = null
  },
})
const remove = useMutation({
  mutationFn: (template: IssueTemplate) =>
    client.templates.delete({ workspaceSlug: slug.value, id: template.id }),
  onSuccess: (_result, template) => {
    toast.success(`Deleted "${template.name}"`)
    deleting.value = null
  },
  onError: (error) => toast.error(errorMessage(error)),
  onSettled: () => queryClient.invalidateQueries({ queryKey: templatesKey() }),
})
</script>

<template>
  <div class="grid gap-3">
    <div class="flex items-center justify-between gap-4">
      <p class="text-ink-subtle">
        Prefill title, description and properties when creating an issue.
      </p>
      <Button size="sm" @click="openForm(null)">
        <Plus aria-hidden="true" />
        New template
      </Button>
    </div>
    <ul
      v-if="templates?.length"
      class="divide-y divide-hairline rounded-lg border border-hairline bg-surface-1"
      aria-label="Templates"
    >
      <li
        v-for="template in templates"
        :key="template.id"
        class="flex items-center gap-3 px-4 py-2"
      >
        <LayoutTemplate class="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-ink">{{ template.name }}</p>
          <p v-if="template.title" class="truncate text-xs text-ink-subtle">
            {{ template.title }}
          </p>
        </div>
        <span class="rounded-xs border border-hairline px-1.5 py-0.5 text-xs text-ink-subtle">
          <span class="sr-only">Scope:</span>
          {{ scopeName(template) }}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          :aria-label="`Edit ${template.name}`"
          @click="openForm(template)"
        >
          <Pencil aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          :aria-label="`Delete ${template.name}`"
          @click="deleting = template"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </li>
    </ul>
    <p
      v-else-if="!isPending"
      class="rounded-lg border border-dashed border-hairline px-4 py-6 text-center text-ink-subtle"
    >
      No templates yet
    </p>

    <TemplateFormDialog v-model:open="formOpen" :template="editing" :team-id="teamId ?? null" />

    <Dialog v-model:open="confirmOpen">
      <DialogContent class="rounded-xl border-hairline bg-floating sm:max-w-md">
        <DialogTitle class="text-[15px] font-semibold text-ink">Delete template?</DialogTitle>
        <DialogDescription class="text-ink-subtle">
          "{{ deleting?.name }}" will no longer be offered when creating issues. Issues created from
          it are not affected.
        </DialogDescription>
        <DialogFooter class="flex-row justify-end gap-2">
          <Button variant="ghost" size="sm" @click="deleting = null">Cancel</Button>
          <Button
            variant="destructive"
            size="sm"
            :disabled="remove.isPending.value"
            @click="deleting && remove.mutate(deleting)"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
