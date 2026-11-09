<script setup lang="ts">
import { ExternalLink, X } from '@lucide/vue'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Full-size view of an image (comment and description attachments): the image fitted to
 * the window on a dim overlay; click outside, Esc or Close dismisses it. The content is
 * scoped to the dark tokens (`.dark`) because the backdrop is dark in both themes.
 */
defineProps<{ src: string; alt?: string }>()
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-50 bg-lightbox data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      />
      <DialogContent
        class="dark fixed inset-0 z-50 flex flex-col text-ink outline-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        :aria-describedby="undefined"
        @click.self="open = false"
      >
        <header class="flex h-12 shrink-0 items-center gap-2 px-3">
          <DialogTitle class="min-w-0 flex-1 truncate text-[13px] text-ink-muted">
            {{ alt || 'Image' }}
          </DialogTitle>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                as="a"
                :href="src"
                target="_blank"
                rel="noopener noreferrer"
                variant="ghost"
                size="icon-sm"
                class="text-ink-muted hover:bg-surface-3 hover:text-ink"
                aria-label="Open original in a new tab"
              >
                <ExternalLink aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open original</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <DialogClose as-child>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="text-ink-muted hover:bg-surface-3 hover:text-ink"
                  aria-label="Close"
                >
                  <X aria-hidden="true" />
                </Button>
              </DialogClose>
            </TooltipTrigger>
            <TooltipContent class="flex items-center gap-2">
              Close <kbd class="font-sans text-ink-subtle">Esc</kbd>
            </TooltipContent>
          </Tooltip>
        </header>
        <div
          class="flex min-h-0 flex-1 items-center justify-center p-4 pt-0 md:p-10 md:pt-0"
          @click.self="open = false"
        >
          <img
            :src="src"
            :alt="alt ?? ''"
            class="max-h-full max-w-full rounded-md object-contain shadow-floating"
          />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
