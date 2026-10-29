<script setup lang="ts">
import { nameSchema, teamKeySchema, workspaceSlugSchema } from '@linear/contract'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useForm } from 'vee-validate'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { z } from 'zod'
import FormField from '@/components/common/FormField.vue'
import { Button } from '@/components/ui/button'
import { errorCode, errorMessage } from '@/lib/errors'
import { toTypedSchema } from '@/lib/form-schema'
import { orpc } from '@/lib/orpc'
import { suggestSlug, suggestTeamKey } from '@/lib/slug'

const router = useRouter()
const queryClient = useQueryClient()
const formError = ref<string | null>(null)

const schema = z.object({
  name: nameSchema,
  slug: workspaceSlugSchema,
  teamName: nameSchema,
  teamKey: teamKeySchema,
})

const { handleSubmit, isSubmitting, values, setFieldValue, setFieldError, isFieldDirty } = useForm({
  validationSchema: toTypedSchema(schema),
  initialValues: { name: '', slug: '', teamName: '', teamKey: '' },
})

// Suggest URL and key from the names until the user edits them.
watch(
  () => values.name,
  (name) => {
    if (!isFieldDirty('slug')) setFieldValue('slug', suggestSlug(name ?? ''), false)
  },
)
watch(
  () => values.teamName,
  (name) => {
    if (!isFieldDirty('teamKey')) setFieldValue('teamKey', suggestTeamKey(name ?? ''), false)
  },
)

const create = useMutation(orpc.workspaces.create.mutationOptions())

const onSubmit = handleSubmit(async (form) => {
  formError.value = null
  try {
    const { workspace } = await create.mutateAsync({
      name: form.name,
      slug: form.slug,
      team: { name: form.teamName, key: form.teamKey },
    })
    await queryClient.invalidateQueries({ queryKey: orpc.me.listWorkspaces.key() })
    await router.push({ name: 'my-issues', params: { workspaceSlug: workspace.slug } })
  } catch (error) {
    if (errorCode(error) === 'CONFLICT') setFieldError('slug', errorMessage(error))
    else formError.value = errorMessage(error)
  }
})
</script>

<template>
  <form class="grid gap-6" novalidate @submit="onSubmit">
    <fieldset class="grid gap-4">
      <legend class="mb-3 text-xs font-medium tracking-wide text-ink-subtle uppercase">
        Workspace
      </legend>
      <FormField name="name" label="Workspace name" placeholder="Tip" autofocus />
      <FormField
        name="slug"
        label="Workspace URL"
        placeholder="tip"
        hint="Used in links, e.g. /tip/my-issues"
      />
    </fieldset>
    <fieldset class="grid gap-4">
      <legend class="mb-3 text-xs font-medium tracking-wide text-ink-subtle uppercase">
        First team
      </legend>
      <FormField name="teamName" label="Team name" placeholder="Tip Development" />
      <FormField
        name="teamKey"
        label="Team identifier"
        placeholder="TIP"
        mono
        hint="Prefix for issue IDs, e.g. TIP-200. 2–10 letters or digits."
      />
    </fieldset>
    <p v-if="formError" class="text-sm text-danger" role="alert">{{ formError }}</p>
    <Button type="submit" class="w-full" :disabled="isSubmitting">
      {{ isSubmitting ? 'Creating…' : 'Create workspace' }}
    </Button>
  </form>
</template>
