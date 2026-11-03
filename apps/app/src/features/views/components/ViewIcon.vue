<script setup lang="ts">
import type { ViewColor, ViewIcon } from '@linear/contract'
import { VIEW_COLOR_CLASSES, VIEW_ICON_COMPONENTS } from '../view-appearance'

defineProps<{ icon: ViewIcon; color: ViewColor }>()
</script>

<template>
  <component
    :is="VIEW_ICON_COMPONENTS[icon]"
    class="size-4 shrink-0"
    :class="VIEW_COLOR_CLASSES[color]"
    aria-hidden="true"
  />
</template>
