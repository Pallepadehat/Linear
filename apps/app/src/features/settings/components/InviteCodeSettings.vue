<script setup lang="ts">
import { Copy, RefreshCw } from '@lucide/vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { copyText } from '@/lib/clipboard'
import { errorMessage } from '@/lib/errors'
import { orpc } from '@/lib/orpc'

const { slug } = useCurrentWorkspace()
const queryClient = useQueryClient()
const input = computed(() => ({ workspaceSlug: slug.value }))
const inviteQuery = computed(() => orpc.workspaces.getInvite.queryOptions({ input: input.value }))
const { data: invite, isPending } = useQuery(inviteQuery)

const onSuccess = (data: { code: string | null }) =>
  queryClient.setQueryData(inviteQuery.value.queryKey, data)
const onError = (error: unknown) => toast.error(errorMessage(error))
const reset = useMutation(orpc.workspaces.resetInvite.mutationOptions({ onSuccess, onError }))
const disable = useMutation(orpc.workspaces.disableInvite.mutationOptions({ onSuccess, onError }))
const busy = computed(() => reset.isPending.value || disable.isPending.value)

// Shown as ABCDE-FGHJK; joining ignores the dash.
const display = computed(() => {
  const code = invite.value?.code
  return code ? `${code.slice(0, 5)}-${code.slice(5)}` : null
})
const joinUrl = computed(() => new URL('/setup?mode=join', window.location.origin).toString())

async function copy(text: string, what: string) {
  try {
    await copyText(text)
    toast.success(`${what} copied to clipboard`)
  } catch {
    toast.error(`Couldn't copy the ${what.toLowerCase()}`)
  }
}
</script>

<template>
  <div class="rounded-lg border border-hairline bg-surface-1">
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
      <div class="grid min-w-0 gap-0.5">
        <span class="text-ink-muted">Invite code</span>
        <span class="text-xs text-ink-subtle">
          <template v-if="display">
            Anyone with this code can join as a member at
            <span class="font-mono">{{ joinUrl }}</span>
          </template>
          <template v-else-if="!isPending">Joining by code is off.</template>
        </span>
      </div>
      <div v-if="!isPending" class="flex shrink-0 items-center gap-2">
        <template v-if="display">
          <code
            class="rounded-md border border-hairline bg-surface-2 px-2 py-1 font-mono text-ink select-all"
            data-testid="invite-code"
            >{{ display }}</code
          >
          <Button size="sm" variant="secondary" @click="copy(display, 'Invite code')">
            <Copy aria-hidden="true" />
            Copy
          </Button>
          <Button size="sm" variant="ghost" :disabled="busy" @click="reset.mutate(input)">
            <RefreshCw aria-hidden="true" />
            Reset
          </Button>
          <Button size="sm" variant="ghost" :disabled="busy" @click="disable.mutate(input)">
            Turn off
          </Button>
        </template>
        <Button v-else size="sm" :disabled="busy" @click="reset.mutate(input)">
          Create invite code
        </Button>
      </div>
    </div>
  </div>
</template>
