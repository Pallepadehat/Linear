<script setup lang="ts">
import type { Label } from '@linear/contract'
import { useQuery } from '@tanstack/vue-query'
import { Check, Trash2 } from '@lucide/vue'
import { computed, ref } from 'vue'
import IconButton from '@/components/common/IconButton.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { LABEL_PALETTE } from '../label-options'
import { labelListOptions, useDeleteLabel, useUpdateLabel } from '../queries'

// Lists one scope's labels: the workspace's (`teamId` null) or a team's own.
// Any member may rename, recolor and delete labels (docs/domain.md → Labels).
const props = defineProps<{ teamId: string | null }>()

const { slug } = useCurrentWorkspace()
const { data, isPending } = useQuery(
  computed(() => labelListOptions(slug.value, props.teamId ?? undefined)),
)
const labels = computed(() => (data.value ?? []).filter((l) => l.teamId === props.teamId))

const update = useUpdateLabel()
const remove = useDeleteLabel()

function rename(label: Label, event: Event) {
  const input = event.target as HTMLInputElement
  const name = input.value.trim()
  if (!name) {
    input.value = label.name
    return
  }
  if (name === label.name) return
  update.mutate(
    { workspaceSlug: slug.value, id: label.id, name },
    { onError: () => (input.value = label.name) },
  )
}

function revert(label: Label, event: KeyboardEvent) {
  const input = event.target as HTMLInputElement
  input.value = label.name
  input.blur()
}

function recolor(label: Label, color: string) {
  if (color !== label.color) update.mutate({ workspaceSlug: slug.value, id: label.id, color })
}

const pendingDelete = ref<Label | null>(null)
const confirmOpen = computed({
  get: () => pendingDelete.value !== null,
  set: (open: boolean) => {
    if (!open) pendingDelete.value = null
  },
})
function confirmDelete() {
  const label = pendingDelete.value
  if (!label) return
  remove.mutate({ workspaceSlug: slug.value, id: label.id })
  pendingDelete.value = null
}
</script>

<template>
  <div class="grid gap-2">
    <p v-if="isPending" class="text-ink-subtle">Loading labels…</p>
    <p v-else-if="labels.length === 0" class="text-ink-subtle">
      No labels yet. Create one by typing a new name in an issue's label picker.
    </p>
    <ul
      v-else
      class="divide-y divide-hairline rounded-lg border border-hairline bg-surface-1"
      aria-label="Labels"
    >
      <li v-for="label in labels" :key="label.id" class="flex h-11 items-center gap-2 px-2">
        <Popover>
          <Tooltip>
            <TooltipTrigger as-child>
              <PopoverTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  :aria-label="`Change color of ${label.name}`"
                  class="data-[state=open]:bg-surface-2"
                >
                  <!-- The label's own color is user data, not a design token. -->
                  <span
                    class="size-2.5 rounded-full"
                    :style="{ backgroundColor: label.color }"
                    aria-hidden="true"
                  />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Change color</TooltipContent>
          </Tooltip>
          <PopoverContent
            align="start"
            class="w-auto rounded-lg border-hairline bg-floating p-2 shadow-floating"
          >
            <div class="grid grid-cols-9 gap-1" role="group" aria-label="Label color">
              <button
                v-for="color in LABEL_PALETTE"
                :key="color"
                type="button"
                class="flex size-6 items-center justify-center rounded-full outline-hidden hover:bg-floating-hover focus-visible:ring-2 focus-visible:ring-ring"
                :aria-label="color"
                :aria-pressed="label.color === color"
                @click="recolor(label, color)"
              >
                <span
                  class="flex size-3.5 items-center justify-center rounded-full"
                  :style="{ backgroundColor: color }"
                >
                  <Check
                    v-if="label.color === color"
                    class="size-2.5 text-canvas"
                    :stroke-width="3"
                    aria-hidden="true"
                  />
                </span>
              </button>
            </div>
          </PopoverContent>
        </Popover>
        <input
          :value="label.name"
          :aria-label="`Rename ${label.name}`"
          maxlength="80"
          class="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-[13px] text-ink outline-hidden hover:border-hairline focus-visible:border-hairline-strong focus-visible:ring-2 focus-visible:ring-ring"
          @change="rename(label, $event)"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
          @keydown.esc="revert(label, $event)"
        />
        <IconButton
          :icon="Trash2"
          :label="`Delete ${label.name}`"
          class="hover:text-ink"
          @click="pendingDelete = label"
        />
      </li>
    </ul>

    <Dialog v-model:open="confirmOpen">
      <DialogContent class="max-w-sm gap-4 rounded-xl border-hairline bg-floating p-5">
        <DialogTitle class="text-[15px] font-semibold text-ink">Delete label?</DialogTitle>
        <DialogDescription class="text-[13px] text-ink-muted">
          “{{ pendingDelete?.name }}” will be removed from every issue that uses it. This can't be
          undone.
        </DialogDescription>
        <DialogFooter class="flex-row justify-end gap-2">
          <Button variant="ghost" size="sm" @click="pendingDelete = null">Cancel</Button>
          <Button variant="destructive" size="sm" @click="confirmDelete">Delete label</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
