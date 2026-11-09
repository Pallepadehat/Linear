<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { useForm } from 'vee-validate'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import FormField from '@/components/common/FormField.vue'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { toTypedSchema } from '@/lib/form-schema'
import { registerSchema } from '../schemas'

const router = useRouter()
const queryClient = useQueryClient()
const formError = ref<string | null>(null)

const { handleSubmit, isSubmitting } = useForm({
  validationSchema: toTypedSchema(registerSchema),
  initialValues: { name: '', email: '', password: '' },
})

const onSubmit = handleSubmit(async (values) => {
  formError.value = null
  const { error } = await authClient.signUp.email(values)
  if (error) {
    formError.value = error.message ?? 'Could not create the account'
    return
  }
  queryClient.clear()
  await router.replace({ name: 'workspace-setup' })
})
</script>

<template>
  <form class="grid gap-4" novalidate @submit="onSubmit">
    <FormField name="name" label="Name" autocomplete="name" autofocus />
    <FormField name="email" label="Email" type="email" autocomplete="email" />
    <FormField
      name="password"
      label="Password"
      type="password"
      autocomplete="new-password"
      hint="At least 8 characters"
    />
    <p v-if="formError" class="text-sm text-danger" role="alert">{{ formError }}</p>
    <Button type="submit" class="w-full" :disabled="isSubmitting">
      {{ isSubmitting ? 'Creating account…' : 'Create account' }}
    </Button>
  </form>
</template>
