<script setup lang="ts">
import type { Component } from 'vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

defineOptions({ inheritAttrs: false })

/** Round icon-only button with an aria-label and a tooltip ("New issue  C"). */
defineProps<{ icon: Component; label: string; shortcut?: string }>()
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button
        variant="ghost"
        size="icon-sm"
        class="shrink-0 text-ink-subtle"
        :aria-label="label"
        :aria-keyshortcuts="shortcut"
        v-bind="$attrs"
      >
        <component :is="icon" aria-hidden="true" />
      </Button>
    </TooltipTrigger>
    <TooltipContent class="flex items-center gap-2">
      {{ label }}
      <kbd v-if="shortcut" class="font-sans text-ink-subtle">{{ shortcut }}</kbd>
    </TooltipContent>
  </Tooltip>
</template>
