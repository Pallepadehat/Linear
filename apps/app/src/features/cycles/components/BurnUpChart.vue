<script setup lang="ts">
import type { CycleDetail } from '@linear/contract'
import { computed } from 'vue'
import { burnUpPoints, cycleDays } from '../cycles'

// Scope vs. completed per cycle day, from the daily snapshots the cycles job records.
const props = defineProps<{ cycle: CycleDetail; now?: Date }>()

const WIDTH = 480
const HEIGHT = 140
const PAD = { top: 8, right: 8, bottom: 20, left: 24 }

const days = computed(() => cycleDays(props.cycle))
const points = computed(() =>
  burnUpPoints(props.cycle.scopeSnapshot, props.cycle.completedSnapshot),
)
const max = computed(() =>
  Math.max(1, props.cycle.progress.scope, ...points.value.map((p) => p.scope)),
)

const x = (day: number) =>
  PAD.left + (days.value <= 1 ? 0 : (day / (days.value - 1)) * (WIDTH - PAD.left - PAD.right))
const y = (value: number) => PAD.top + (1 - value / max.value) * (HEIGHT - PAD.top - PAD.bottom)

const line = (key: 'scope' | 'completed') =>
  points.value
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)} ${y(p[key]).toFixed(1)}`)
    .join(' ')
const scopePath = computed(() => line('scope'))
const completedPath = computed(() => line('completed'))
const completedArea = computed(() => {
  const first = points.value[0]
  const last = points.value.at(-1)
  if (!first || !last) return ''
  const base = y(0).toFixed(1)
  return `${completedPath.value} L${x(last.day).toFixed(1)} ${base} L${x(first.day).toFixed(1)} ${base} Z`
})

const today = computed(() => {
  const now = props.now ?? new Date()
  const day = Math.floor((now.getTime() - props.cycle.startsAt.getTime()) / 86_400_000)
  return day >= 0 && day < days.value ? day : null
})

const summary = computed(() => {
  const last = points.value.at(-1)
  if (!last) return 'No progress recorded yet'
  return `Day ${last.day + 1} of ${days.value}: ${last.completed} of ${last.scope} issues completed`
})
</script>

<template>
  <figure class="grid gap-2">
    <svg
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      class="h-36 w-full max-w-xl"
      role="img"
      :aria-label="`Burn-up chart. ${summary}`"
    >
      <!-- Axis baseline and the top of the scale. -->
      <line
        :x1="PAD.left"
        :x2="WIDTH - PAD.right"
        :y1="y(0)"
        :y2="y(0)"
        class="stroke-hairline-strong"
        stroke-width="1"
      />
      <line
        :x1="PAD.left"
        :x2="WIDTH - PAD.right"
        :y1="y(max)"
        :y2="y(max)"
        class="stroke-hairline"
        stroke-width="1"
        stroke-dasharray="2 3"
      />
      <text
        :x="PAD.left - 6"
        :y="y(max) + 4"
        text-anchor="end"
        class="fill-ink-tertiary text-[10px]"
      >
        {{ max }}
      </text>
      <text :x="PAD.left - 6" :y="y(0) + 4" text-anchor="end" class="fill-ink-tertiary text-[10px]">
        0
      </text>
      <text :x="PAD.left" :y="HEIGHT - 4" class="fill-ink-tertiary text-[10px]">Day 1</text>
      <text
        :x="WIDTH - PAD.right"
        :y="HEIGHT - 4"
        text-anchor="end"
        class="fill-ink-tertiary text-[10px]"
      >
        Day {{ days }}
      </text>
      <line
        v-if="today !== null"
        :x1="x(today)"
        :x2="x(today)"
        :y1="PAD.top"
        :y2="y(0)"
        class="stroke-hairline-tertiary"
        stroke-width="1"
        stroke-dasharray="3 3"
      />
      <path v-if="completedArea" :d="completedArea" class="fill-status-completed opacity-15" />
      <path
        v-if="scopePath"
        :d="scopePath"
        fill="none"
        class="stroke-ink-tertiary"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <path
        v-if="completedPath"
        :d="completedPath"
        fill="none"
        class="stroke-status-completed"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <template v-if="points.length === 1">
        <circle
          :cx="x(points[0]!.day)"
          :cy="y(points[0]!.scope)"
          r="2.5"
          class="fill-ink-tertiary"
        />
        <circle
          :cx="x(points[0]!.day)"
          :cy="y(points[0]!.completed)"
          r="2.5"
          class="fill-status-completed"
        />
      </template>
    </svg>
    <figcaption class="flex items-center gap-4 text-xs text-ink-subtle">
      <span class="flex items-center gap-1.5">
        <span class="h-0.5 w-3 rounded-full bg-ink-tertiary" aria-hidden="true" />
        Scope
      </span>
      <span class="flex items-center gap-1.5">
        <span class="h-0.5 w-3 rounded-full bg-status-completed" aria-hidden="true" />
        Completed
      </span>
      <span class="ml-auto">{{ summary }}</span>
    </figcaption>
  </figure>
</template>
