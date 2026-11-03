<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatDay } from '../project-dates'
import { buildProgressChart, nearestPoint, type ProgressPoint } from '../progress-chart'

const props = defineProps<{ series: ProgressPoint[]; targetDate: string | null }>()

// The SVG stretches to the card's width; strokes don't scale with it
// (`vector-effect`), and the hover markers are HTML positioned in percent.
const W = 600
const H = 120
const chart = computed(() => buildProgressChart(props.series, props.targetDate, W, H))

const active = ref<number | null>(null)
const activePoint = computed(() =>
  active.value === null ? null : (props.series[active.value] ?? null),
)
const activeLeft = computed(() =>
  active.value === null || !chart.value ? 0 : (chart.value.xs[active.value]! / W) * 100,
)

function onPointerMove(event: PointerEvent) {
  if (!chart.value) return
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  active.value = nearestPoint(chart.value.xs, ((event.clientX - box.left) / box.width) * W)
}

// Arrow keys walk the days so the tooltip is reachable without a pointer.
function onKeydown(event: KeyboardEvent) {
  const last = props.series.length - 1
  const current = active.value ?? last
  const next =
    event.key === 'ArrowLeft'
      ? Math.max(0, current - 1)
      : event.key === 'ArrowRight'
        ? Math.min(last, current + 1)
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : null
  if (next === null) return
  event.preventDefault()
  active.value = next
}

const ROWS = [
  { key: 'scope', label: 'Scope', swatch: 'bg-status-neutral' },
  { key: 'started', label: 'Started', swatch: 'bg-status-started' },
  { key: 'completed', label: 'Completed', swatch: 'bg-status-completed' },
] as const

/** Hover dots on each band's upper edge (bands are stacked, like the areas). */
const markers = computed(() => {
  const p = activePoint.value
  const c = chart.value
  if (!p || !c) return []
  const edges = [p.scope, p.completed + p.started, p.completed]
  return ROWS.map((row, i) => ({
    key: row.key,
    swatch: row.swatch,
    top: (c.y(edges[i]!) / H) * 100,
  }))
})
</script>

<template>
  <div v-if="chart" class="grid gap-1">
    <div
      class="relative h-30 rounded-md outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      tabindex="0"
      role="img"
      :aria-label="`Progress from ${formatDay(chart.start)} to ${formatDay(chart.end)}. Use the arrow keys to read each day.`"
      @pointermove="onPointerMove"
      @pointerleave="active = null"
      @focus="active = series.length - 1"
      @blur="active = null"
      @keydown="onKeydown"
    >
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        preserveAspectRatio="none"
        class="absolute inset-0 size-full overflow-visible"
        aria-hidden="true"
      >
        <line
          v-for="f in [0, 0.5]"
          :key="f"
          x1="0"
          :x2="W"
          :y1="f * H"
          :y2="f * H"
          class="stroke-hairline"
          vector-effect="non-scaling-stroke"
        />
        <polygon :points="chart.scopeArea" class="fill-status-neutral/10" />
        <polygon :points="chart.startedArea" class="fill-status-started/35" />
        <polygon :points="chart.completedArea" class="fill-status-completed/45" />
        <polyline
          :points="chart.scopeLine"
          class="fill-none stroke-status-neutral"
          stroke-width="2"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
        <polyline
          :points="chart.startedLine"
          class="fill-none stroke-status-started"
          stroke-width="2"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
        <polyline
          :points="chart.completedLine"
          class="fill-none stroke-status-completed"
          stroke-width="2"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
        <line
          v-if="chart.projection"
          v-bind="chart.projection"
          class="stroke-status-completed"
          stroke-width="1.5"
          stroke-dasharray="4 4"
          vector-effect="non-scaling-stroke"
        />
        <line
          :x1="chart.todayX"
          :x2="chart.todayX"
          y1="0"
          :y2="H"
          class="stroke-ink-tertiary"
          stroke-width="1"
          stroke-dasharray="2 3"
          vector-effect="non-scaling-stroke"
        />
        <line
          x1="0"
          :x2="W"
          :y1="H"
          :y2="H"
          class="stroke-hairline-strong"
          vector-effect="non-scaling-stroke"
        />
      </svg>

      <template v-if="activePoint">
        <div
          class="pointer-events-none absolute inset-y-0 w-px bg-hairline-strong"
          :style="{ left: `${activeLeft}%` }"
        />
        <span
          v-for="marker in markers"
          :key="marker.key"
          class="pointer-events-none absolute size-2 -translate-1/2 rounded-full ring-2 ring-surface-1"
          :class="marker.swatch"
          :style="{ left: `${activeLeft}%`, top: `${marker.top}%` }"
        />
        <div
          role="status"
          class="pointer-events-none absolute top-0 z-10 grid min-w-32 gap-1 rounded-md border border-hairline bg-floating px-2.5 py-2 text-xs shadow-floating"
          :class="activeLeft > 60 ? '-translate-x-full -ml-2' : 'ml-2'"
          :style="{ left: `${activeLeft}%` }"
        >
          <span class="font-medium text-ink">{{ formatDay(activePoint.date) }}</span>
          <span v-for="row in ROWS" :key="row.key" class="flex items-center gap-2 text-ink-subtle">
            <span class="size-2 rounded-full" :class="row.swatch" aria-hidden="true" />
            <span class="flex-1">{{ row.label }}</span>
            <span class="text-ink tabular-nums">{{ activePoint[row.key] }}</span>
          </span>
        </div>
      </template>
    </div>
    <div class="flex justify-between text-xs text-ink-tertiary tabular-nums" aria-hidden="true">
      <span>{{ formatDay(chart.start) }}</span>
      <span
        >{{ targetDate && targetDate === chart.end ? 'Target · ' : ''
        }}{{ formatDay(chart.end) }}</span
      >
    </div>
    <table class="sr-only">
      <caption>
        Issues per day
      </caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th v-for="row in ROWS" :key="row.key" scope="col">{{ row.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in series" :key="p.date">
          <th scope="row">{{ p.date }}</th>
          <td>{{ p.scope }}</td>
          <td>{{ p.started }}</td>
          <td>{{ p.completed }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
