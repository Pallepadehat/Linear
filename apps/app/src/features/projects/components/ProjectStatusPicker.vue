<script setup lang="ts">
import type { ProjectStatus } from '@linear/contract'
import { computed, ref } from 'vue'
import PickerItem from '@/components/common/PickerItem.vue'
import PickerPopover from '@/components/common/PickerPopover.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import { PROJECT_STATUSES, projectStatusMeta } from '../project-status'

const model = defineModel<ProjectStatus>({ required: true })
const open = ref(false)
const current = computed(() => projectStatusMeta(model.value))

function choose(value: ProjectStatus) {
  model.value = value
  open.value = false
}
</script>

<template>
  <PickerPopover
    v-model:open="open"
    label="Change project status"
    placeholder="Change status..."
    :current="model"
  >
    <template #trigger>
      <StatusIcon :category="current.icon" />
      <span>{{ current.label }}</span>
    </template>
    <PickerItem
      v-for="(status, i) in PROJECT_STATUSES"
      :key="status.value"
      :value="status.value"
      :selected="status.value === model"
      :shortcut="String(i + 1)"
      @select="choose(status.value)"
    >
      <StatusIcon :category="status.icon" />
      {{ status.label }}
    </PickerItem>
  </PickerPopover>
</template>
