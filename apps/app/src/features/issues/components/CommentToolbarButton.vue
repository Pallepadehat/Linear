<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// An icon-only circle button in a comment's hover toolbar; the label is its
// accessible name and tooltip.
defineOptions({ inheritAttrs: false })
defineProps<{ label: string }>()
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button
        v-bind="$attrs"
        type="button"
        variant="ghost"
        size="icon-xs"
        :aria-label="label"
        class="text-ink-subtle hover:bg-floating-hover"
      >
        <slot />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="top">{{ label }}</TooltipContent>
  </Tooltip>
</template>
