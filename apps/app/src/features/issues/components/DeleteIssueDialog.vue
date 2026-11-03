<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useUiStore } from '@/stores/ui'
import { useDeleteIssue } from '../queries'

// Confirms ⌘⌫ / the command menu's "Delete issue" for `ui.issueToDelete`.
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const { slug } = useCurrentWorkspace()
const deleteIssue = useDeleteIssue(slug)

const open = computed({
  get: () => ui.issueToDelete !== null,
  set: (value) => {
    if (!value) ui.issueToDelete = null
  },
})
// Kept while the dialog animates closed.
const identifier = computed(() => ui.issueToDelete?.identifier ?? '')

async function confirm() {
  const target = ui.issueToDelete
  if (!target) return
  ui.issueToDelete = null
  // Leave the issue's own page first so it doesn't flash "not found".
  const onIssuePage =
    route.name === 'issue' &&
    String(route.params.identifier).toUpperCase() === target.identifier.toUpperCase()
  if (onIssuePage) {
    if (window.history.state?.back) router.back()
    else await router.replace({ name: 'issues' })
  }
  deleteIssue.mutate(target)
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent
      class="gap-4 rounded-xl border-hairline bg-floating p-5 shadow-floating sm:max-w-md"
    >
      <AlertDialogHeader class="gap-1.5 text-left">
        <AlertDialogTitle class="text-[15px] font-semibold text-ink">
          Delete {{ identifier }}?
        </AlertDialogTitle>
        <AlertDialogDescription class="text-[13px] text-ink-muted">
          The issue, its comments and attachments are deleted for everyone. This can't be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :class="buttonVariants({ variant: 'secondary', size: 'sm' })">
          Cancel
        </AlertDialogCancel>
        <AlertDialogAction
          :class="buttonVariants({ variant: 'destructive', size: 'sm' })"
          @click="confirm"
        >
          Delete issue
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
