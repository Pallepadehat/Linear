<script setup lang="ts">
import type { Component } from 'vue'
import KeyCaps from '@/components/common/KeyCaps.vue'
import { CommandItem } from '@/components/ui/command'
import { shortcutKeys, type ShortcutId } from '@/lib/hotkeys'

// One command menu row: icon, label, and the shortcut that does the same thing.
defineProps<{ value: string; icon?: Component; shortcut?: ShortcutId }>()
const emit = defineEmits<{ select: [] }>()
</script>

<template>
  <CommandItem
    :value="value"
    class="h-10 gap-3 rounded-md px-3 text-[13px] text-ink data-[highlighted]:bg-floating-hover data-[highlighted]:text-ink"
    @select="emit('select')"
  >
    <component :is="icon" v-if="icon" class="size-4 text-ink-muted" aria-hidden="true" />
    <slot />
    <KeyCaps v-if="shortcut" :keys="shortcutKeys(shortcut)" class="ml-auto" />
  </CommandItem>
</template>
