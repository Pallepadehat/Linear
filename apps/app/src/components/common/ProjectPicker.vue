<script setup lang="ts">
import { computed, ref } from 'vue'
import PickerItem from './PickerItem.vue'
import PickerPopover from './PickerPopover.vue'
import ProjectIcon from './ProjectIcon.vue'

export type ProjectOption = { id: string; name: string; iconUrl?: string | null }

// `row` renders the list-row chip: a hairline pill aligned to the row's end; rows only
// render it when the issue has a project.
const props = defineProps<{ projects: ProjectOption[]; row?: boolean }>()
const model = defineModel<string | null>({ required: true })
const open = ref(false)

// Pickers match on `value`, and "none" must not collide with a project id.
const NONE = '__none__'
const current = computed(() => props.projects.find((p) => p.id === model.value))

function choose(id: string | null) {
  model.value = id
  open.value = false
}
</script>

<template>
  <PickerPopover
    v-model:open="open"
    label="Change project"
    placeholder="Add to project..."
    :current="model ?? NONE"
    :align="row ? 'end' : 'start'"
    :trigger-class="
      row
        ? 'h-6 max-w-40 gap-1.5 border border-hairline px-2 text-xs font-normal text-ink-muted has-[>svg]:px-2'
        : undefined
    "
  >
    <template #trigger>
      <ProjectIcon :src="current?.iconUrl" />
      <span v-if="current" class="max-w-40 truncate">{{ current.name }}</span>
      <span v-else class="text-ink-subtle">Project</span>
    </template>
    <PickerItem :value="NONE" :selected="model === null" shortcut="0" @select="choose(null)">
      <ProjectIcon />
      <span class="text-ink-subtle">No project</span>
    </PickerItem>
    <PickerItem
      v-for="(project, i) in projects"
      :key="project.id"
      :value="project.id"
      :selected="project.id === model"
      :shortcut="i < 9 ? String(i + 1) : undefined"
      @select="choose(project.id)"
    >
      <ProjectIcon :src="project.iconUrl" />
      <span class="truncate">{{ project.name }}</span>
    </PickerItem>
  </PickerPopover>
</template>
