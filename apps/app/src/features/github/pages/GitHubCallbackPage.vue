<script setup lang="ts">
import { useMutation } from '@tanstack/vue-query'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { errorMessage } from '@/lib/errors'
import { orpc } from '@/lib/orpc'

// GitHub redirects here (the App's callback URL) after an install, with
// installation_id, setup_action, state and the OAuth code in the query.
const route = useRoute()
const router = useRouter()
const error = ref<string | null>(null)
const complete = useMutation(orpc.github.completeInstall.mutationOptions())

function param(name: string) {
  const value = route.query[name]
  return typeof value === 'string' && value ? value : null
}

onMounted(async () => {
  if (param('setup_action') === 'request') {
    error.value = 'Installation requested. A GitHub organization owner has to approve it first.'
    return
  }
  const state = param('state')
  const code = param('code')
  const installationId = Number(param('installation_id'))
  if (!state || !code || !Number.isSafeInteger(installationId) || installationId <= 0) {
    error.value = "GitHub didn't send the installation details. Start again from settings."
    return
  }
  try {
    const result = await complete.mutateAsync({ state, code, installationId })
    toast.success(`Connected ${result.installation.accountLogin}`)
    await router.replace({ name: 'settings', params: { workspaceSlug: result.workspaceSlug } })
  } catch (err) {
    error.value = errorMessage(err)
  }
})
</script>

<template>
  <div class="grid gap-6 text-center" role="status" aria-live="polite">
    <div class="space-y-1">
      <h1 class="text-xl font-semibold tracking-tight text-ink">
        {{ error ? "Couldn't connect GitHub" : 'Connecting GitHub…' }}
      </h1>
      <p v-if="error" class="text-ink-subtle">{{ error }}</p>
    </div>
    <p v-if="error">
      <RouterLink to="/" class="font-medium text-link hover:underline"
        >Back to your workspace</RouterLink
      >
    </p>
  </div>
</template>
