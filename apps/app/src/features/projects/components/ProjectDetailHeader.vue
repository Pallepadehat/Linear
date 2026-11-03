<script setup lang="ts">
import type { Project } from '@linear/contract'
import { Ellipsis, Link, PanelRight, Star, StarOff, Trash2 } from '@lucide/vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'
import { computed, ref, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import IconButton from '@/components/common/IconButton.vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { favoriteListOptions, useToggleFavorite } from '@/features/favorites/queries'
import { PANEL_HEADER_ACTIONS } from '@/layouts/panel-header'
import { errorMessage } from '@/lib/errors'
import { orpc } from '@/lib/orpc'
import { usePreferencesStore } from '@/stores/preferences'
import { useUiStore } from '@/stores/ui'
import { invalidateProjects } from '../queries'

// Breadcrumb "Projects › icon name", the star (layout, via `favoriteTarget`) and the page
// actions in the panel header: copy link, the "…" menu and the right panel toggle.
const props = defineProps<{ workspaceSlug: string; project: Project }>()

const ui = useUiStore()
const router = useRouter()
const queryClient = useQueryClient()
const { projectPanelOpen } = storeToRefs(usePreferencesStore())

watchEffect(
  () => {
    void router.currentRoute.value.path
    ui.breadcrumb = [
      { label: 'Projects', to: { name: 'projects', params: { workspaceSlug: props.workspaceSlug } } },
      { label: props.project.name, projectIcon: { src: props.project.iconUrl } },
    ]
    ui.favoriteTarget = {
      entityType: 'project',
      entityId: props.project.id,
      name: props.project.name,
      iconUrl: props.project.iconUrl,
    }
  },
  // After the layout's reset on navigation.
  { flush: 'post' },
)

const favorites = useToggleFavorite(() => props.workspaceSlug)
const isFavorite = computed(() =>
  favorites.isFavorite({ entityType: 'project', entityId: props.project.id }),
)
function toggleFavorite() {
  if (ui.favoriteTarget?.entityId === props.project.id) favorites.toggle(ui.favoriteTarget)
}

/** The project's own URL, without the tab or filters. */
async function copyLink() {
  const { href } = router.resolve({
    name: 'project',
    params: { workspaceSlug: props.workspaceSlug, projectId: props.project.id },
  })
  try {
    await navigator.clipboard.writeText(new URL(href, window.location.origin).toString())
    toast.success('Project link copied to clipboard')
  } catch {
    toast.error("Couldn't copy the link")
  }
}

const confirmingDelete = ref(false)
const deleteProject = useMutation(orpc.projects.delete.mutationOptions())
async function confirmDelete() {
  const { id, name } = props.project
  try {
    await deleteProject.mutateAsync({ workspaceSlug: props.workspaceSlug, id })
  } catch (error) {
    toast.error(`Couldn't delete ${name}`, { description: errorMessage(error) })
    return
  }
  toast.success(`${name} deleted`)
  await router.replace({ name: 'projects', params: { workspaceSlug: props.workspaceSlug } })
  // Its favorite goes with it (server side); issues lose the project.
  void invalidateProjects(queryClient)
  void queryClient.invalidateQueries({
    queryKey: favoriteListOptions(props.workspaceSlug).queryKey,
  })
}

const panelLabel = computed(() => (projectPanelOpen.value ? 'Hide details' : 'Show details'))
</script>

<template>
  <Teleport defer :to="PANEL_HEADER_ACTIONS">
    <div class="flex items-center gap-0.5">
      <IconButton :icon="Link" label="Copy project link" @click="copyLink" />
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger as-child>
            <DropdownMenuTrigger
              class="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-subtle outline-hidden hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-surface-2"
              aria-label="Project options"
            >
              <Ellipsis class="size-4" aria-hidden="true" />
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Project options</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" class="w-56">
          <DropdownMenuItem class="h-8 rounded-md text-[13px]" @select="toggleFavorite">
            <component :is="isFavorite ? StarOff : Star" class="size-4" aria-hidden="true" />
            {{ isFavorite ? 'Remove from favorites' : 'Add to favorites' }}
          </DropdownMenuItem>
          <DropdownMenuItem class="h-8 rounded-md text-[13px]" @select="copyLink">
            <Link class="size-4" aria-hidden="true" />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            class="h-8 rounded-md text-[13px]"
            @select="confirmingDelete = true"
          >
            <Trash2 class="size-4" aria-hidden="true" />
            Delete project…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <IconButton
        :icon="PanelRight"
        :label="panelLabel"
        :aria-pressed="projectPanelOpen"
        aria-controls="project-panel"
        :class="projectPanelOpen && 'text-ink'"
        @click="projectPanelOpen = !projectPanelOpen"
      />
    </div>
  </Teleport>

  <AlertDialog v-model:open="confirmingDelete">
    <AlertDialogContent
      class="gap-4 rounded-xl border-hairline bg-floating p-5 shadow-floating sm:max-w-md"
    >
      <AlertDialogHeader class="gap-1.5 text-left">
        <AlertDialogTitle class="text-[15px] font-semibold text-ink">
          Delete {{ project.name }}?
        </AlertDialogTitle>
        <AlertDialogDescription class="text-[13px] text-ink-muted">
          Its issues stay in their teams without a project. Milestones and resources are deleted.
          This can't be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :class="buttonVariants({ variant: 'secondary', size: 'sm' })">
          Cancel
        </AlertDialogCancel>
        <AlertDialogAction
          :class="buttonVariants({ variant: 'destructive', size: 'sm' })"
          @click="confirmDelete"
        >
          Delete project
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
