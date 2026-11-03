<script setup lang="ts">
defineProps<{ name: string }>()
</script>

<template>
  <span
    class="inline-flex size-4 shrink-0 items-center justify-center rounded-xs bg-surface-4 text-[9px] font-semibold text-ink-muted"
    aria-hidden="true"
    >{{ name.trim().charAt(0).toUpperCase() }}</span
  >
</template>
