<script setup lang="ts">
import type { Milestone } from '@linear/contract'
import { computed, ref } from 'vue'
import { milestonePercent } from '@/features/projects/milestones'
import MilestoneIcon from './MilestoneIcon.vue'
import PickerItem from './PickerItem.vue'
import PickerPopover from './PickerPopover.vue'

// Offers "No milestone" plus the issue project's milestones in their order, each with
// its progress. The caller only renders it while the issue has a project.
const props = defineProps<{ milestones: Milestone[] }>()
const model = defineModel<string | null>({ required: true })
const open = ref(false)

// Pickers match on `value`, and "none" must not collide with a milestone id.
const NONE = '__none__'
const current = computed(() => props.milestones.find((m) => m.id === model.value))

function choose(id: string | null) {
  model.value = id
  open.value = false
}
</script>

<template>
  <PickerPopover
    v-model:open="open"
    label="Change milestone"
    placeholder="Set milestone..."
    :current="model ?? NONE"
  >
    <template #trigger>
      <MilestoneIcon :progress="current?.progress" />
      <span v-if="current" class="max-w-40 truncate">{{ current.name }}</span>
      <span v-else class="text-ink-subtle">Milestone</span>
    </template>
    <PickerItem :value="NONE" :selected="model === null" shortcut="0" @select="choose(null)">
      <MilestoneIcon />
      <span class="text-ink-subtle">No milestone</span>
    </PickerItem>
    <PickerItem
      v-for="(milestone, i) in milestones"
      :key="milestone.id"
      :value="milestone.id"
      :selected="milestone.id === model"
      :shortcut="i < 9 ? String(i + 1) : undefined"
      @select="choose(milestone.id)"
    >
      <MilestoneIcon :progress="milestone.progress" />
      <span class="truncate">{{ milestone.name }}</span>
      <span class="shrink-0 text-ink-subtle tabular-nums">{{ milestonePercent(milestone) }}%</span>
    </PickerItem>
  </PickerPopover>
</template>
