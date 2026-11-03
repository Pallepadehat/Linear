<script setup lang="ts">
// Key caps for one shortcut (`formatSequence` output): chords read "G then I".
defineProps<{ keys: string[][] }>()
</script>

<template>
  <span class="inline-flex items-center gap-1 text-xs text-ink-subtle">
    <template v-for="(stroke, i) in keys" :key="i">
      <span v-if="i > 0" class="text-ink-tertiary">then</span>
      <kbd
        v-for="cap in stroke"
        :key="cap"
        class="inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-hairline-strong px-1 font-sans text-xs text-ink-muted"
        >{{ cap }}</kbd
      >
    </template>
  </span>
</template>
