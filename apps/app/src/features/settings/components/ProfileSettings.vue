<script setup lang="ts">
import { nameSchema } from '@linear/contract'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useForm } from 'vee-validate'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { z } from 'zod'
import FormField from '@/components/common/FormField.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/features/auth/composables/useSession'
import { useUpload } from '@/features/uploads/useUpload'
import { errorMessage } from '@/lib/errors'
import { toTypedSchema } from '@/lib/form-schema'
import { orpc } from '@/lib/orpc'

const queryClient = useQueryClient()
const { data: user } = useCurrentUser()
const { upload, isUploading } = useUpload()
const fileInput = ref<HTMLInputElement | null>(null)

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

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const uploadId = await upload(file, { kind: 'avatar' })
    await update.mutateAsync({ avatarUploadId: uploadId })
    toast.success('Avatar updated')
  } catch (error) {
    toast.error(error instanceof Error && !('code' in error) ? error.message : errorMessage(error))
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
      <div class="flex gap-2">
        <input
          ref="fileInput"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          class="sr-only"
          tabindex="-1"
          aria-hidden="true"
          @change="onFile"
        />
        <Button variant="secondary" size="sm" :disabled="isUploading" @click="fileInput?.click()">
          {{ isUploading ? 'Uploading…' : 'Upload avatar' }}
        </Button>
        <Button
          v-if="user?.avatarUrl"
          variant="ghost"
          size="sm"
          :disabled="update.isPending.value"
          @click="removeAvatar"
        >
          Remove
        </Button>
      </div>
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
