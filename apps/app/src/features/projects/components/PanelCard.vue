<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { ref, useId } from 'vue'

// A collapsible card in the project's right panel.
// An absent boolean prop is `false` in Vue, hence the explicit default.
const props = withDefaults(defineProps<{ title: string; defaultOpen?: boolean }>(), {
  defaultOpen: true,
})
defineSlots<{ default: () => unknown; actions?: () => unknown }>()

const open = ref(props.defaultOpen)
const contentId = useId()
</script>

<template>
  <section class="rounded-lg border border-hairline bg-surface-1" :aria-label="title">
    <div class="flex h-9 items-center gap-1 pr-2 pl-1">
      <button
        type="button"
        class="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 text-left text-xs font-medium text-ink-subtle outline-hidden hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
        :aria-expanded="open"
        :aria-controls="contentId"
        @click="open = !open"
      >
        {{ title }}
        <ChevronDown
          class="size-3.5 shrink-0 transition-transform"
          :class="{ '-rotate-90': !open }"
          aria-hidden="true"
        />
      </button>
      <slot name="actions" />
    </div>
    <div v-show="open" :id="contentId" class="px-2 pb-2">
      <slot />
    </div>
  </section>
</template>
