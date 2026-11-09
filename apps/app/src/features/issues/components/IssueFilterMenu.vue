<script setup lang="ts">
import { parseDate, type DateValue } from '@internationalized/date'
import {
  CalendarArrowDown,
  CalendarArrowUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListFilter,
} from '@lucide/vue'
import { computed, nextTick, ref, watch } from 'vue'
import PickerInput from '@/components/common/PickerInput.vue'
import PickerItem from '@/components/common/PickerItem.vue'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { todayIso } from '@/lib/due-dates'
import type { FilterDimension, FilterOption } from '../composables/useFilterDimensions'
import IssueFilterSearchResults from './IssueFilterSearchResults.vue'

// Linear's "Add Filter…" menu: a searchable list of dimensions (typing also finds
// values across them), each opening its own page of values in place. ↵ opens a page
// or toggles a value (multi-value pages stay open); Backspace or ← in an empty
// search goes back; Escape closes. Dates nest one level deeper (Dates › Created).
// `compact`: a round icon button with a tooltip, for the view toolbar (which binds `F` to `open`).
const props = defineProps<{ dimensions: FilterDimension[]; compact?: boolean }>()
const open = defineModel<boolean>('open', { default: false })

type Page = { kind: 'root' } | { kind: 'dates' } | { kind: 'dimension'; key: string }
const page = ref<Page>({ kind: 'root' })
/** On a date page: picking the day for "Before…" / "After…". */
const dateBound = ref<'before' | 'after' | null>(null)
const contentDraft = ref('')

watch(open, (value) => {
  if (value) return
  page.value = { kind: 'root' }
  dateBound.value = null
})

const current = computed(() =>
  page.value.kind === 'dimension'
    ? props.dimensions.find((d) => d.key === (page.value as { key: string }).key)
    : undefined,
)
const rootDimensions = computed(() => props.dimensions.filter((d) => !d.group))
const dateDimensions = computed(() => props.dimensions.filter((d) => d.group === 'dates'))
/** Where the "Dates" row goes: after Labels, like Linear. */
const datesAfter = computed(() => {
  const index = rootDimensions.value.findIndex((d) => d.key === 'label')
  return index === -1 ? rootDimensions.value.length - 1 : index
})
const rootEntries = computed(() => [...rootDimensions.value.map((d) => d.label), 'Dates'])
const pageKey = computed(() =>
  page.value.kind === 'dimension' ? `dimension:${page.value.key}` : page.value.kind,
)
const placeholder = computed(() => {
  if (page.value.kind === 'root') return 'Add Filter…'
  if (page.value.kind === 'dates') return 'Dates…'
  return `${current.value?.label ?? 'Filter'}…`
})

function openDimension(dimension: FilterDimension) {
  page.value = { kind: 'dimension', key: dimension.key }
  dateBound.value = null
  contentDraft.value = dimension.text?.value ?? ''
}

function back() {
  if (dateBound.value) dateBound.value = null
  else if (current.value?.group === 'dates') page.value = { kind: 'dates' }
  else page.value = { kind: 'root' }
}

function pick(dimension: FilterDimension, option: FilterOption) {
  option.toggle()
  if (dimension.single) open.value = false
}

function pickDay(value: DateValue | undefined) {
  if (!value || !dateBound.value || !current.value?.date) return
  current.value.date.set({ kind: dateBound.value, date: value.toString() })
  open.value = false
}

function applyContent() {
  current.value?.text?.set(contentDraft.value)
  open.value = false
}

// Backspace / ← in an empty search field steps back a page.
function onKeydown(event: KeyboardEvent) {
  if (page.value.kind === 'root' || (event.key !== 'Backspace' && event.key !== 'ArrowLeft')) return
  const input = event.target
  if (input instanceof HTMLInputElement && input.value !== '') return
  event.preventDefault()
  back()
}

const today = computed(() => {
  void open.value
  return todayIso()
})
const calendarValue = computed(() => {
  const value = current.value?.date?.value
  return value && value.kind !== 'past' ? parseDate(value.date) : undefined
})

// The content page's input takes focus when it appears.
const contentInput = ref<HTMLInputElement | null>(null)
watch(
  () => current.value?.text && page.value.kind === 'dimension',
  async (isText) => {
    if (!isText) return
    await nextTick()
    contentInput.value?.focus()
  },
)
</script>

<template>
  <Popover v-model:open="open">
    <Tooltip v-if="compact">
      <TooltipTrigger as-child>
        <PopoverTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            class="text-ink-subtle data-[state=open]:bg-surface-2 data-[state=open]:text-ink"
            aria-label="Filter"
            aria-keyshortcuts="F"
          >
            <ListFilter aria-hidden="true" />
          </Button>
        </PopoverTrigger>
      </TooltipTrigger>
      <TooltipContent class="flex items-center gap-2">
        Filter
        <kbd class="font-sans text-ink-subtle">F</kbd>
      </TooltipContent>
    </Tooltip>
    <PopoverTrigger v-else as-child>
      <Button variant="ghost" size="sm" class="text-ink-muted data-[state=open]:bg-surface-2">
        <ListFilter aria-hidden="true" />
        Filter
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      class="w-64 overflow-hidden rounded-lg border-hairline bg-floating p-0 shadow-floating"
    >
      <!-- Content: free text, applied with ↵. -->
      <form v-if="current?.text" class="flex flex-col" @submit.prevent="applyContent">
        <div class="flex h-10 items-center gap-2 border-b border-hairline px-2">
          <button
            type="button"
            class="flex size-6 items-center justify-center rounded-full text-ink-subtle hover:bg-floating-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
            aria-label="Back"
            @click="back"
          >
            <ChevronLeft class="size-4" aria-hidden="true" />
          </button>
          <input
            ref="contentInput"
            v-model="contentDraft"
            maxlength="255"
            placeholder="Title or description contains…"
            aria-label="Content contains"
            class="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink caret-primary outline-hidden placeholder:text-ink-tertiary"
            @keydown.backspace="contentDraft === '' && ($event.preventDefault(), back())"
          />
        </div>
        <p class="px-3.5 py-2 text-xs text-ink-subtle">Press ↵ to filter</p>
      </form>

      <!-- Before… / After…: pick the day. -->
      <div v-else-if="current?.date && dateBound" class="flex flex-col">
        <div
          class="flex h-10 items-center gap-2 border-b border-hairline px-2 text-[13px] text-ink"
        >
          <button
            type="button"
            class="flex size-6 items-center justify-center rounded-full text-ink-subtle hover:bg-floating-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
            aria-label="Back"
            @click="back"
          >
            <ChevronLeft class="size-4" aria-hidden="true" />
          </button>
          {{ current.label }} {{ dateBound }}…
        </div>
        <Calendar
          :model-value="calendarValue"
          :default-placeholder="calendarValue ?? parseDate(today)"
          :week-starts-on="1"
          initial-focus
          class="self-center text-[13px] text-ink"
          @update:model-value="pickDay"
        />
      </div>

      <Command v-else :key="pageKey" class="bg-transparent" @keydown="onKeydown">
        <PickerInput :placeholder="placeholder" :hotkey="page.kind === 'root' ? 'F' : undefined" />
        <CommandList class="max-h-80 p-1.5" :aria-label="placeholder">
          <template v-if="page.kind === 'root'">
            <CommandGroup class="p-0">
              <template v-for="(dimension, index) in rootDimensions" :key="dimension.key">
                <CommandItem
                  :value="dimension.key"
                  class="h-8 gap-2.5 rounded-md px-2.5 text-[13px] text-ink data-[highlighted]:bg-floating-hover"
                  @select.prevent="openDimension(dimension)"
                >
                  <component
                    :is="dimension.icon"
                    class="size-4 text-ink-subtle"
                    aria-hidden="true"
                  />
                  {{ dimension.label }}
                  <span
                    v-if="dimension.active"
                    class="ml-auto text-xs text-ink-subtle tabular-nums"
                  >
                    {{ dimension.selectedLabels.length || 1 }}
                  </span>
                  <ChevronRight
                    class="size-3.5 text-ink-subtle"
                    :class="{ 'ml-auto': !dimension.active }"
                    aria-hidden="true"
                  />
                </CommandItem>
                <CommandItem
                  v-if="index === datesAfter && dateDimensions.length"
                  value="dates"
                  class="h-8 gap-2.5 rounded-md px-2.5 text-[13px] text-ink data-[highlighted]:bg-floating-hover"
                  @select.prevent="page = { kind: 'dates' }"
                >
                  <CalendarDays class="size-4 text-ink-subtle" aria-hidden="true" />
                  Dates
                  <ChevronRight class="ml-auto size-3.5 text-ink-subtle" aria-hidden="true" />
                </CommandItem>
              </template>
            </CommandGroup>
            <IssueFilterSearchResults
              :dimensions="dimensions"
              :entries="rootEntries"
              @pick="pick"
            />
          </template>

          <CommandGroup v-else-if="page.kind === 'dates'" class="p-0">
            <CommandItem
              v-for="dimension in dateDimensions"
              :key="dimension.key"
              :value="dimension.key"
              class="h-8 gap-2.5 rounded-md px-2.5 text-[13px] text-ink data-[highlighted]:bg-floating-hover"
              @select.prevent="openDimension(dimension)"
            >
              <component :is="dimension.icon" class="size-4 text-ink-subtle" aria-hidden="true" />
              {{ dimension.label }}
              <span v-if="dimension.active" class="ml-auto truncate text-xs text-ink-subtle">
                {{ dimension.summary }}
              </span>
              <ChevronRight
                class="size-3.5 shrink-0 text-ink-subtle"
                :class="{ 'ml-auto': !dimension.active }"
                aria-hidden="true"
              />
            </CommandItem>
          </CommandGroup>

          <CommandGroup v-else-if="current" class="p-0">
            <p v-if="current.options.length === 0" class="px-2.5 py-2 text-ink-subtle">
              No options
            </p>
            <PickerItem
              v-for="option in current.options"
              :key="option.key"
              :value="option.key"
              :selected="option.selected"
              @select="pick(current, option)"
            >
              <component :is="option.icon" class="size-4 text-ink-subtle" aria-hidden="true" />
              <span class="truncate">{{ option.label }}</span>
            </PickerItem>
            <template v-if="current.date">
              <PickerItem
                value="Before…"
                :selected="current.date.value?.kind === 'before'"
                @select="dateBound = 'before'"
              >
                <CalendarArrowDown class="size-4 text-ink-subtle" aria-hidden="true" />
                Before…
              </PickerItem>
              <PickerItem
                value="After…"
                :selected="current.date.value?.kind === 'after'"
                @select="dateBound = 'after'"
              >
                <CalendarArrowUp class="size-4 text-ink-subtle" aria-hidden="true" />
                After…
              </PickerItem>
            </template>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
