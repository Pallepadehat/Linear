<script setup lang="ts">
import { DialogContent, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { watch } from 'vue'
import SheetOverlay from '@/components/ui/sheet/SheetOverlay.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import { useUiStore } from '@/stores/ui'
import AppSidebar from './AppSidebar.vue'

/** The sidebar as a left drawer on phone widths; opened from the panel header's menu button. */
const ui = useUiStore()
const isMobile = useIsMobile()

// Widening the window past `md` shows the docked sidebar, so the drawer goes away.
watch(isMobile, (mobile) => {
  if (!mobile) ui.sidebarOpen = false
})
</script>

<template>
  <DialogRoot v-model:open="ui.sidebarOpen">
    <DialogPortal>
      <SheetOverlay />
      <DialogContent
        class="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] border-r border-hairline bg-app-base outline-hidden data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:animate-in data-[state=open]:slide-in-from-left"
        :aria-describedby="undefined"
      >
        <DialogTitle class="sr-only">Navigation</DialogTitle>
        <AppSidebar class="w-full" />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
