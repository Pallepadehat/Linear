<script setup lang="ts">
import type { ProjectLabel } from '@linear/contract'
import { Plus, Tag } from '@lucide/vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import PickerItem from '@/components/common/PickerItem.vue'
import PickerPopover from '@/components/common/PickerPopover.vue'
import { errorMessage } from '@/lib/errors'
import { orpc } from '@/lib/orpc'
import { defaultLabelColor } from '../project-labels'
import { projectLabelListOptions } from '../queries'
import PickerSearchAction from './PickerSearchAction.vue'

// Project labels are their own set (not issue labels); a name that doesn't exist yet
// can be created right from the filter.
const props = defineProps<{ labels: ProjectLabel[]; workspaceSlug: string }>()
const model = defineModel<string[]>({ required: true })

const queryClient = useQueryClient()
const selected = computed(() => props.labels.filter((l) => model.value.includes(l.id)))
const isNewName = (text: string) => text.length <= 80 && !props.labels.some((l) => l.name === text)

// Multi-select: stays open so several labels can be toggled in a row.
function toggle(id: string) {
  model.value = model.value.includes(id)
    ? model.value.filter((v) => v !== id)
    : [...model.value, id]
}

const create = useMutation(orpc.projectLabels.create.mutationOptions())
async function createLabel(name: string) {
  try {
    const label = await create.mutateAsync({
      workspaceSlug: props.workspaceSlug,
      name,
      color: defaultLabelColor(name),
    })
    queryClient.setQueryData(projectLabelListOptions(props.workspaceSlug).queryKey, (list) =>
      [...(list ?? []), label].sort((a, b) => a.name.localeCompare(b.name)),
    )
    model.value = [...model.value, label.id]
  } catch (error) {
    toast.error("Couldn't create label", { description: errorMessage(error) })
  }
}
</script>

<template>
  <PickerPopover label="Change project labels" placeholder="Change or create labels...">
    <template #trigger>
      <Tag class="size-3.5 text-ink-subtle" aria-hidden="true" />
      <span v-if="selected.length === 0" class="text-ink-subtle">Labels</span>
      <span v-else-if="selected.length === 1">{{ selected[0]?.name }}</span>
      <span v-else>{{ selected.length }} labels</span>
    </template>
    <PickerItem
      v-for="label in labels"
      :key="label.id"
      :value="label.id"
      :selected="model.includes(label.id)"
      @select="toggle(label.id)"
    >
      <span
        class="size-2 shrink-0 rounded-full"
        :style="{ backgroundColor: label.color }"
        aria-hidden="true"
      />
      {{ label.name }}
    </PickerItem>
    <PickerSearchAction :accepts="isNewName" @select="createLabel">
      <template #default="{ search }">
        <Plus class="size-4 text-ink-subtle" aria-hidden="true" />
        Create label "{{ search }}"
      </template>
    </PickerSearchAction>
  </PickerPopover>
</template>
