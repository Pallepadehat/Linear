<script setup lang="ts">
import type { Cycle } from '@linear/contract'
import { computed, ref } from 'vue'
import { cycleName, cyclePercent, cycleRange } from '@/features/cycles/cycles'
import CycleIcon from './CycleIcon.vue'
import PickerItem from './PickerItem.vue'
import PickerPopover from './PickerPopover.vue'

// Offers "No cycle" plus the team's current and upcoming cycles (`cycles`, soonest
// first). An issue's cycle that has since ended still shows on the trigger.
const props = defineProps<{
  cycles: Cycle[]
  /** The selected cycle when it isn't in `cycles` (e.g. a completed one). */
  selected?: Cycle | null
  compact?: boolean
  noHotkey?: boolean
}>()
const model = defineModel<string | null>({ required: true })
const open = ref(false)

// Pickers match on `value`, and "none" must not collide with a cycle id.
const NONE = '__none__'
const current = computed(
  () =>
    props.cycles.find((c) => c.id === model.value) ??
    (props.selected?.id === model.value ? props.selected : undefined),
)

function choose(id: string | null) {
  model.value = id
  open.value = false
}
</script>

<template>
  <PickerPopover
    v-model:open="open"
    label="Change cycle"
    placeholder="Add to cycle..."
    :hotkey="noHotkey ? undefined : 'Shift+C'"
    :compact="compact"
    :current="model ?? NONE"
  >
    <template #trigger>
      <CycleIcon :progress="current ? cyclePercent(current.progress) / 100 : undefined" />
      <template v-if="!compact">
        <span v-if="current" class="max-w-48 truncate">{{ cycleName(current) }}</span>
        <span v-else class="text-ink-subtle">Cycle</span>
      </template>
      <span v-else-if="current" class="sr-only">{{ cycleName(current) }}</span>
    </template>
    <PickerItem :value="NONE" :selected="model === null" shortcut="0" @select="choose(null)">
      <CycleIcon />
      <span class="text-ink-subtle">No cycle</span>
    </PickerItem>
    <PickerItem
      v-for="(cycle, i) in cycles"
      :key="cycle.id"
      :value="cycle.id"
      :selected="cycle.id === model"
      :shortcut="i < 9 ? String(i + 1) : undefined"
      @select="choose(cycle.id)"
    >
      <CycleIcon :progress="cyclePercent(cycle.progress) / 100" />
      <span class="truncate">{{ cycleName(cycle) }}</span>
      <span class="shrink-0 text-ink-subtle">{{ cycleRange(cycle) }}</span>
    </PickerItem>
  </PickerPopover>
</template>
