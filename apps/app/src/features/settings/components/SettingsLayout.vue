<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { cn } from '@/lib/utils'

export type SettingsNavItem = { id: string; label: string }

/**
 * Settings page frame: title, then a section nav — a sticky column on desktop, a sticky
 * horizontal pill strip on phones — beside the `SettingsSection`s in the default slot.
 * The nav follows the scroll position and `#section` deep links land on their section.
 */
const props = defineProps<{ title: string; subtitle?: string; sections: SettingsNavItem[] }>()

const route = useRoute()
const router = useRouter()
const active = ref(props.sections[0]?.id ?? '')
const root = ref<HTMLElement | null>(null)
const pills = ref<HTMLElement | null>(null)

// While a click's smooth scroll runs, the clicked section stays active (short sections at the
// bottom never reach the top of the panel, so the observer alone would never pick them).
let lockedUntil = 0
function go(id: string) {
  active.value = id
  lockedUntil = Date.now() + 800
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  void router.replace({ hash: `#${id}` })
}

// Keep the active pill in view on the phone strip.
watch(active, async (id) => {
  await nextTick()
  pills.value
    ?.querySelector<HTMLElement>(`[data-id="${id}"]`)
    ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
})

// The current section is the last one whose top has passed just below the sticky bars; at the
// very bottom it's the last section, since short trailing sections can't reach the top.
let scroller: HTMLElement | null = null
function syncActive() {
  if (!scroller || Date.now() < lockedUntil) return
  const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4
  const line = scroller.getBoundingClientRect().top + 120
  let current = props.sections[0]?.id ?? ''
  for (const section of props.sections) {
    const el = document.getElementById(section.id)
    if (el && el.getBoundingClientRect().top <= line) current = section.id
  }
  active.value = atBottom ? (props.sections.at(-1)?.id ?? current) : current
}

onMounted(async () => {
  scroller = root.value?.closest('main') ?? null
  scroller?.addEventListener('scroll', syncActive, { passive: true })

  const hash = route.hash.slice(1)
  if (hash && props.sections.some((s) => s.id === hash)) {
    await nextTick()
    active.value = hash
    document.getElementById(hash)?.scrollIntoView({ block: 'start' })
  } else syncActive()
})
onBeforeUnmount(() => scroller?.removeEventListener('scroll', syncActive))

const linkClass = (id: string) =>
  cn(
    'rounded-md text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
    active.value === id
      ? 'bg-surface-3 text-ink'
      : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  )
</script>

<template>
  <div ref="root" class="mx-auto flex w-full max-w-5xl gap-10 px-4 pb-16 md:px-8">
    <nav
      :aria-label="`${title} sections`"
      class="sticky top-0 hidden h-fit w-44 shrink-0 gap-px pt-8 md:grid"
    >
      <button
        v-for="section in sections"
        :key="section.id"
        type="button"
        :class="cn(linkClass(section.id), 'h-7 px-2')"
        :aria-current="active === section.id ? 'location' : undefined"
        @click="go(section.id)"
      >
        {{ section.label }}
      </button>
    </nav>
    <div class="grid min-w-0 flex-1 content-start gap-8 pt-6 md:max-w-3xl md:pt-8">
      <header class="grid gap-1">
        <h1 class="text-lg font-semibold tracking-tight text-ink">{{ title }}</h1>
        <p v-if="subtitle || $slots.subtitle" class="text-ink-subtle">
          <slot name="subtitle">{{ subtitle }}</slot>
        </p>
      </header>
      <nav
        ref="pills"
        :aria-label="`${title} sections`"
        class="sticky top-0 z-10 -mx-4 -mt-4 flex gap-1 overflow-x-auto border-b border-hairline bg-panel px-4 py-2 [scrollbar-width:none] md:hidden"
      >
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          :data-id="section.id"
          :class="cn(linkClass(section.id), 'h-7 shrink-0 rounded-full px-3')"
          :aria-current="active === section.id ? 'location' : undefined"
          @click="go(section.id)"
        >
          {{ section.label }}
        </button>
      </nav>
      <slot />
    </div>
  </div>
</template>
