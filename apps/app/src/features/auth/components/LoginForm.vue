<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { useForm } from 'vee-validate'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FormField from '@/components/common/FormField.vue'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { toTypedSchema } from '@/lib/form-schema'
import { loginSchema } from '../schemas'

const router = useRouter()
const route = useRoute()
const queryClient = useQueryClient()
const formError = ref<string | null>(null)

const { handleSubmit, isSubmitting } = useForm({
  validationSchema: toTypedSchema(loginSchema),
  initialValues: { email: '', password: '' },
})

const onSubmit = handleSubmit(async (values) => {
  formError.value = null
  const { error } = await authClient.signIn.email(values)
  if (error) {
    formError.value =
      error.status === 401 ? 'Wrong email or password' : (error.message ?? 'Could not sign in')
    return
  }
  queryClient.clear()
  const redirect =
    typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
      ? route.query.redirect
      : '/'
  await router.replace(redirect)
})
</script>

<template>
  <form class="grid gap-4" novalidate @submit="onSubmit">
    <FormField name="email" label="Email" type="email" autocomplete="email" autofocus />
    <FormField name="password" label="Password" type="password" autocomplete="current-password" />
    <p v-if="formError" class="text-sm text-danger" role="alert">{{ formError }}</p>
    <Button type="submit" class="w-full" :disabled="isSubmitting">
      {{ isSubmitting ? 'Signing in…' : 'Continue' }}
    </Button>
  </form>
</template>
