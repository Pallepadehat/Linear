<script setup lang="ts">
import type { IssueTemplate } from '@linear/contract'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { Ellipsis, LayoutTemplate, Pencil, Trash2 } from '@lucide/vue'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import IconButton from '@/components/common/IconButton.vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
// The settings section header holds the "New template" button.
defineExpose({ create: () => openForm(null) })

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
    <ul
      v-if="templates?.length"
      class="divide-y divide-hairline rounded-lg border border-hairline bg-surface-1"
      aria-label="Templates"
    >
      <li
        v-for="template in templates"
        :key="template.id"
        class="flex items-center gap-3 py-1.5 pr-2 pl-4"
      >
        <LayoutTemplate class="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
        <button
          type="button"
          class="min-w-0 flex-1 rounded-md text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          :aria-label="`Edit ${template.name}`"
          @click="openForm(template)"
        >
          <span class="block truncate text-ink hover:underline">{{ template.name }}</span>
          <span v-if="template.title" class="block truncate text-xs text-ink-subtle">
            {{ template.title }}
          </span>
        </button>
        <span
          class="shrink-0 rounded-xs border border-hairline px-1.5 py-0.5 text-xs text-ink-subtle max-sm:hidden"
        >
          <span class="sr-only">Scope:</span>
          {{ scopeName(template) }}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <IconButton
              :icon="Ellipsis"
              :label="`${template.name} actions`"
              class="data-[state=open]:bg-surface-2"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-44">
            <DropdownMenuItem @select="openForm(template)">
              <Pencil aria-hidden="true" />
              Edit…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" @select="deleting = template">
              <Trash2 aria-hidden="true" />
              Delete…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    </ul>
    <p
      v-else-if="!isPending"
      class="rounded-lg border border-dashed border-hairline px-4 py-6 text-center text-ink-subtle"
    >
      No templates yet. Create one to prefill new issues.
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
            Delete template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
