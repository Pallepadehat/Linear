<script setup lang="ts">
import { nameSchema, teamKeySchema } from '@linear/contract'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useForm } from 'vee-validate'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { z } from 'zod'
import FormField from '@/components/common/FormField.vue'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { errorCode, errorMessage } from '@/lib/errors'
import { toTypedSchema } from '@/lib/form-schema'
import { orpc } from '@/lib/orpc'
import { suggestTeamKey } from '@/lib/slug'

const router = useRouter()
const queryClient = useQueryClient()
const { slug } = useCurrentWorkspace()
const formError = ref<string | null>(null)

const {
  handleSubmit,
  isSubmitting,
  values,
  setFieldValue,
  setFieldError,
  isFieldDirty,
  resetForm,
} = useForm({
  validationSchema: toTypedSchema(z.object({ name: nameSchema, key: teamKeySchema })),
  initialValues: { name: '', key: '' },
})

watch(
  () => values.name,
  (name) => {
    if (!isFieldDirty('key')) setFieldValue('key', suggestTeamKey(name ?? ''), false)
  },
)

const create = useMutation(orpc.teams.create.mutationOptions())

const onSubmit = handleSubmit(async (form) => {
  formError.value = null
  try {
    const team = await create.mutateAsync({ workspaceSlug: slug.value, ...form })
    await queryClient.invalidateQueries({ queryKey: orpc.teams.list.key() })
    resetForm()
    await router.push({
      name: 'team-issues',
      params: { workspaceSlug: slug.value, teamKey: team.key },
    })
  } catch (error) {
    if (errorCode(error) === 'CONFLICT') setFieldError('key', errorMessage(error))
    else formError.value = errorMessage(error)
  }
})
</script>

<template>
  <form
    class="grid gap-4 sm:grid-cols-[1fr_10rem_auto] sm:items-start"
    novalidate
    @submit="onSubmit"
  >
    <FormField name="name" label="Team name" placeholder="Tip Development" />
    <FormField name="key" label="Identifier" placeholder="TIP" mono />
    <Button type="submit" size="sm" class="justify-self-start sm:mt-[24px]" :disabled="isSubmitting"
      >Create team</Button
    >
    <p v-if="formError" class="text-sm text-danger sm:col-span-3" role="alert">{{ formError }}</p>
  </form>
</template>
