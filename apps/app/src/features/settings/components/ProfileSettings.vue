<script setup lang="ts">
import { nameSchema } from '@linear/contract'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useForm } from 'vee-validate'
import { watch } from 'vue'
import { toast } from 'vue-sonner'
import { z } from 'zod'
import FormField from '@/components/common/FormField.vue'
import ImageUploadButton from '@/components/common/ImageUploadButton.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/features/auth/composables/useSession'
import { errorMessage } from '@/lib/errors'
import { toTypedSchema } from '@/lib/form-schema'
import { orpc } from '@/lib/orpc'

const queryClient = useQueryClient()
const { data: user } = useCurrentUser()

const update = useMutation(
  orpc.me.update.mutationOptions({
    onSuccess: (me) => {
      queryClient.setQueryData(orpc.me.get.queryKey(), me)
      // Member lists show avatars too.
      void queryClient.invalidateQueries({ queryKey: orpc.workspaces.listMembers.key() })
    },
  }),
)

const { handleSubmit, resetForm, meta } = useForm({
  validationSchema: toTypedSchema(z.object({ name: nameSchema })),
  initialValues: { name: user.value?.name ?? '' },
})
watch(
  () => user.value?.name,
  (name) => {
    if (name !== undefined && !meta.value.dirty) resetForm({ values: { name } })
  },
)

const onSubmit = handleSubmit(async ({ name }) => {
  try {
    await update.mutateAsync({ name })
    resetForm({ values: { name } })
    toast.success('Profile updated')
  } catch (error) {
    toast.error(errorMessage(error))
  }
})

async function onAvatarUploaded(uploadId: string) {
  try {
    await update.mutateAsync({ avatarUploadId: uploadId })
    toast.success('Avatar updated')
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

async function removeAvatar() {
  try {
    await update.mutateAsync({ avatarUploadId: null })
  } catch (error) {
    toast.error(errorMessage(error))
  }
}
</script>

<template>
  <div class="grid gap-6">
    <div class="flex items-center gap-4">
      <UserAvatar :name="user?.name ?? ''" :src="user?.avatarUrl" size="lg" />
      <ImageUploadButton
        kind="avatar"
        label="Upload avatar"
        :has-image="Boolean(user?.avatarUrl)"
        :disabled="update.isPending.value"
        @uploaded="onAvatarUploaded"
        @remove="removeAvatar"
      />
      <p class="text-xs text-ink-subtle">PNG, JPEG or WebP, up to 2 MB.</p>
    </div>
    <form class="grid max-w-sm gap-4" novalidate @submit="onSubmit">
      <FormField name="name" label="Name" autocomplete="name" />
      <div class="grid gap-1.5">
        <span class="text-sm font-medium text-ink-muted">Email</span>
        <span class="text-ink-subtle">{{ user?.email }}</span>
      </div>
      <Button
        type="submit"
        class="justify-self-start"
        :disabled="!meta.dirty || update.isPending.value"
        >Save</Button
      >
    </form>
  </div>
</template>
