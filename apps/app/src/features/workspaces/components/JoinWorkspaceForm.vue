<script setup lang="ts">
import { joinWorkspaceInputSchema } from '@linear/contract'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useForm } from 'vee-validate'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import FormField from '@/components/common/FormField.vue'
import { Button } from '@/components/ui/button'
import { errorCode, errorMessage } from '@/lib/errors'
import { toTypedSchema } from '@/lib/form-schema'
import { orpc } from '@/lib/orpc'

const router = useRouter()
const queryClient = useQueryClient()
const formError = ref<string | null>(null)

const { handleSubmit, isSubmitting, setFieldError } = useForm({
  validationSchema: toTypedSchema(joinWorkspaceInputSchema),
  initialValues: { code: '' },
})

const join = useMutation(orpc.workspaces.join.mutationOptions())

const onSubmit = handleSubmit(async (form) => {
  formError.value = null
  try {
    const workspace = await join.mutateAsync({ code: form.code })
    await queryClient.invalidateQueries({ queryKey: orpc.me.listWorkspaces.key() })
    await router.push({ name: 'my-issues', params: { workspaceSlug: workspace.slug } })
  } catch (error) {
    if (errorCode(error) === 'NOT_FOUND') setFieldError('code', errorMessage(error))
    else formError.value = errorMessage(error)
  }
})
</script>

<template>
  <form class="grid gap-6" novalidate @submit="onSubmit">
    <FormField
      name="code"
      label="Invite code"
      placeholder="ABCDE-FGHJK"
      mono
      autofocus
      autocomplete="off"
      hint="Ask a workspace owner. They find it under Settings → Members."
    />
    <p v-if="formError" class="text-sm text-danger" role="alert">{{ formError }}</p>
    <Button type="submit" class="w-full" :disabled="isSubmitting">
      {{ isSubmitting ? 'Joining…' : 'Join workspace' }}
    </Button>
  </form>
</template>
