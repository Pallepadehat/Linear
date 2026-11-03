<script setup lang="ts">
import { CalendarDays, X } from '@lucide/vue'
import { computed, ref } from 'vue'
import PickerItem from '@/components/common/PickerItem.vue'
import PickerPopover from '@/components/common/PickerPopover.vue'
import { datePresets, formatDay, parseDay } from '../project-dates'
import PickerSearchAction from './PickerSearchAction.vue'

// A start or target date, day resolution: quick picks, or type a date in the filter.
const props = defineProps<{ label: string; compact?: boolean }>()
const model = defineModel<string | null>({ required: true })
const open = ref(false)

const presets = computed(() => (open.value ? datePresets() : []))
const isDate = (text: string) => parseDay(text) !== null

function choose(day: string | null) {
  model.value = day
  open.value = false
}
</script>

<template>
  <PickerPopover
    v-model:open="open"
    :label="`Change ${props.label.toLowerCase()}`"
    placeholder="Type a date, e.g. 2026-12-01..."
    :current="model ?? undefined"
    :trigger-class="compact ? 'w-auto px-2 has-[>svg]:px-2' : undefined"
    :compact="compact"
  >
    <template #trigger>
      <CalendarDays v-if="!compact || !model" class="size-3.5 text-ink-subtle" aria-hidden="true" />
      <span v-if="model" class="tabular-nums">{{ formatDay(model) }}</span>
      <span v-else :class="compact ? 'sr-only' : 'text-ink-subtle'">{{ props.label }}</span>
    </template>
    <PickerSearchAction :accepts="isDate" @select="(text) => choose(parseDay(text))">
      <template #default="{ search }">
        <CalendarDays class="size-4 text-ink-subtle" aria-hidden="true" />
        {{ formatDay(parseDay(search) ?? '') }}
      </template>
    </PickerSearchAction>
    <PickerItem
      v-for="preset in presets"
      :key="preset.label"
      :value="preset.day"
      :selected="preset.day === model"
      @select="choose(preset.day)"
    >
      {{ preset.label }}
      <span class="text-xs text-ink-subtle">{{ formatDay(preset.day) }}</span>
    </PickerItem>
    <PickerItem v-if="model" value="clear" :selected="false" @select="choose(null)">
      <X class="size-4 text-ink-subtle" aria-hidden="true" />
      Remove {{ props.label.toLowerCase() }}
    </PickerItem>
  </PickerPopover>
</template>
