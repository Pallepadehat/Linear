<script setup lang="ts">
import type { StatusCategory } from '@linear/contract'
import { parseDate, type DateValue } from '@internationalized/date'
import { CalendarDays, CalendarX2, Ellipsis } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { Calendar } from '@/components/ui/calendar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  classifyDueDate,
  describeDueDate,
  dueDateShortcuts,
  formatDueDate,
  todayIso,
} from '@/lib/due-dates'
import { cn } from '@/lib/utils'
import PickerItem from './PickerItem.vue'
import PickerPopover from './PickerPopover.vue'

// `row` renders the list-row chip: hidden without a date (⇧D on the focused row still
// opens the picker) and colored by how close the date is. `category` is the issue's
// status category; finished issues are never overdue (docs/domain.md → Due dates).
const props = defineProps<{ row?: boolean; category?: StatusCategory; noHotkey?: boolean }>()
const model = defineModel<string | null>({ required: true })
const open = ref(false)
const custom = ref(false)
watch(open, (value) => {
  if (!value) custom.value = false
})

// Re-read on every open, so a page left open past midnight catches up.
const today = computed(() => {
  void open.value
  return todayIso()
})
const shortcuts = computed(() => dueDateShortcuts(today.value))
const state = computed(() =>
  classifyDueDate(model.value, today.value, props.category ?? 'unstarted'),
)
const label = computed(() => (model.value ? formatDueDate(model.value, today.value) : null))
const hint = computed(() =>
  model.value ? describeDueDate(model.value, today.value, props.category ?? 'unstarted') : '',
)
const tone = computed(() =>
  state.value === 'overdue'
    ? 'text-priority-urgent'
    : state.value === 'dueSoon'
      ? 'text-status-started'
      : props.row
        ? 'text-ink-subtle'
        : 'text-ink',
)
const calendarValue = computed(() => (model.value ? parseDate(model.value) : undefined))

function choose(date: string | null) {
  model.value = date
  open.value = false
}
function pickDay(value: DateValue | undefined) {
  if (value) choose(value.toString())
}
</script>

<template>
  <Tooltip :disabled="!row || !model">
    <TooltipTrigger as-child>
      <span :class="row ? 'flex shrink-0' : 'contents'">
        <PickerPopover
          v-model:open="open"
          label="Change due date"
          placeholder="Set due date…"
          :hotkey="noHotkey ? undefined : 'D'"
          shift
          :current="shortcuts.find((s) => s.date === model)?.label ?? ''"
          :hidden-trigger="row && !model"
          :trigger-class="
            cn(
              tone,
              row &&
                'h-6 gap-1.5 border border-hairline px-2 text-xs font-normal has-[>svg]:px-2 [&_svg]:size-3.5',
            )
          "
          :align="row ? 'end' : 'start'"
        >
          <template #trigger>
            <CalendarDays aria-hidden="true" />
            <span v-if="label">{{ label }}</span>
            <span v-else class="text-ink-subtle">Set due date</span>
            <span v-if="hint" class="sr-only">({{ hint }})</span>
          </template>
          <template v-if="custom" #panel>
            <Calendar
              :model-value="calendarValue"
              :default-placeholder="calendarValue ?? parseDate(today)"
              :week-starts-on="1"
              initial-focus
              class="text-[13px] text-ink"
              @update:model-value="pickDay"
            />
          </template>
          <PickerItem
            v-for="(option, index) in shortcuts"
            :key="option.key"
            :value="option.label"
            :selected="option.date === model"
            :shortcut="String(index + 1)"
            @select="choose(option.date)"
          >
            <CalendarDays class="size-4 text-ink-subtle" aria-hidden="true" />
            {{ option.label }}
            <span class="text-ink-subtle">{{ formatDueDate(option.date, today) }}</span>
          </PickerItem>
          <PickerItem value="Custom…" :selected="false" @select="custom = true">
            <Ellipsis class="size-4 text-ink-subtle" aria-hidden="true" />
            Custom…
          </PickerItem>
          <PickerItem v-if="model" value="Remove due date" :selected="false" @select="choose(null)">
            <CalendarX2 class="size-4 text-ink-subtle" aria-hidden="true" />
            Remove due date
          </PickerItem>
        </PickerPopover>
      </span>
    </TooltipTrigger>
    <TooltipContent>{{ hint }}</TooltipContent>
  </Tooltip>
</template>
