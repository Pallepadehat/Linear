<script setup lang="ts">
import type { View } from '@linear/contract'
import { Copy, Ellipsis, Pencil, Star, StarOff, Trash2 } from '@lucide/vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
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
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useCurrentUser } from '@/features/auth/composables/useSession'
import { useToggleFavorite } from '@/features/favorites/queries'
import { parseDisplayOptions } from '@/features/issues/display-options'
import { errorMessage } from '@/lib/errors'
import { client } from '@/lib/orpc'
import { useDeleteView, viewsKey } from '../queries'
import { canEditView, copyName } from '../view-permissions'
import SaveViewDialog from './SaveViewDialog.vue'

// The view "…" menu: Rename, Duplicate, Delete and Add to favorites (M8-07).
const props = defineProps<{ view: View }>()
const emit = defineEmits<{ deleted: [] }>()

const router = useRouter()
const queryClient = useQueryClient()
const { slug, workspace } = useCurrentWorkspace()
const { data: me } = useCurrentUser()
const { isFavorite, toggle } = useToggleFavorite(slug)
const remove = useDeleteView(slug)

const editable = computed(() => canEditView(props.view, me.value?.id, workspace.value?.role))
const favorite = computed(() => isFavorite({ entityType: 'view', entityId: props.view.id }))
const renameOpen = ref(false)
const deleteOpen = ref(false)

function toggleFavorite() {
  const { id, name, icon, color } = props.view
  toggle({ entityType: 'view', entityId: id, name, icon, color })
}

// A duplicate is the caller's own view, shared like the original.
const duplicate = useMutation({
  mutationFn: () => {
    const { name, icon, color, teamId, filters, display, shared } = props.view
    return client.views.create({
      workspaceSlug: slug.value,
      name: copyName(name),
      icon,
      color,
      teamId,
      filters,
      // Stored options that no longer parse fall back to the defaults.
      display: parseDisplayOptions(display),
      shared,
    })
  },
  onSuccess: (copy) => {
    void queryClient.invalidateQueries({ queryKey: viewsKey() })
    void router.push({ name: 'view', params: { workspaceSlug: slug.value, viewId: copy.id } })
  },
  onError: (error) =>
    toast.error("Couldn't duplicate the view", { description: errorMessage(error) }),
})

function confirmDelete() {
  remove.mutate(props.view, { onSuccess: () => emit('deleted') })
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger
      class="flex size-7 items-center justify-center rounded-full text-ink-subtle outline-hidden hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-surface-2"
      :aria-label="`${view.name} options`"
    >
      <Ellipsis class="size-4" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-52">
      <DropdownMenuItem :disabled="!editable" @select="renameOpen = true">
        <Pencil class="size-4" aria-hidden="true" />
        Rename…
      </DropdownMenuItem>
      <DropdownMenuItem :disabled="duplicate.isPending.value" @select="duplicate.mutate()">
        <Copy class="size-4" aria-hidden="true" />
        Duplicate
      </DropdownMenuItem>
      <DropdownMenuItem @select="toggleFavorite">
        <component :is="favorite ? StarOff : Star" class="size-4" aria-hidden="true" />
        {{ favorite ? 'Remove from favorites' : 'Add to favorites' }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem :disabled="!editable" @select="deleteOpen = true">
        <Trash2 class="size-4" aria-hidden="true" />
        Delete…
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  <SaveViewDialog v-if="renameOpen" v-model:open="renameOpen" :view="view" />
  <AlertDialog v-model:open="deleteOpen">
    <AlertDialogContent
      class="gap-4 rounded-xl border-hairline bg-floating p-5 shadow-floating sm:max-w-md"
    >
      <AlertDialogHeader class="gap-1.5 text-left">
        <AlertDialogTitle class="text-[15px] font-semibold text-ink">
          Delete “{{ view.name }}”?
        </AlertDialogTitle>
        <AlertDialogDescription class="text-[13px] text-ink-muted">
          The view is deleted for everyone, and removed from their favorites. Its issues stay.
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
          Delete view
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
