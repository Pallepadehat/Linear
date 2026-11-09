<script setup lang="ts">
/**
 * One settings section: 15px heading, optional description and header actions, then content.
 * The `id` is the anchor the settings nav scrolls to (and `#id` deep links, e.g. `#github`).
 */
defineProps<{ id: string; title: string; description?: string }>()
</script>

<template>
  <section
    :id="id"
    :aria-labelledby="`${id}-heading`"
    class="grid scroll-mt-16 gap-3 md:scroll-mt-8"
    data-settings-section
  >
    <div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div class="grid min-w-0 gap-1">
        <h2 :id="`${id}-heading`" class="text-[15px] font-semibold text-ink">
          <slot name="title">{{ title }}</slot>
        </h2>
        <p v-if="description || $slots.description" class="text-ink-subtle">
          <slot name="description">{{ description }}</slot>
        </p>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </section>
</template>
