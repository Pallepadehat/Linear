<script setup lang="ts">
import { UPLOAD_RULES, type CreatePresignedUploadInput } from '@linear/contract'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { useUpload } from '@/features/uploads/useUpload'
import { errorMessage } from '@/lib/errors'

// Upload / Remove buttons for a single image (avatar, project icon). The parent saves
// the returned upload id; this only handles picking, validating and uploading the file.
const props = defineProps<{
  kind: Extract<CreatePresignedUploadInput['kind'], 'avatar' | 'workspace_icon' | 'project_icon'>
  workspaceSlug?: string
  label: string
  hasImage: boolean
  disabled?: boolean
}>()
// `file` lets the parent preview the image before the server has processed it.
const emit = defineEmits<{ uploaded: [uploadId: string, file: File]; remove: [] }>()

const { upload, isUploading } = useUpload()
const fileInput = ref<HTMLInputElement | null>(null)
const accept = computed(() => UPLOAD_RULES[props.kind].contentTypes.join(','))

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const uploadId = await upload(file, { kind: props.kind, workspaceSlug: props.workspaceSlug })
    emit('uploaded', uploadId, file)
  } catch (error) {
    // Client-side validation throws plain Errors; API errors carry a code.
    toast.error(error instanceof Error && !('code' in error) ? error.message : errorMessage(error))
  }
}
</script>

<template>
  <div class="flex gap-2">
    <input
      ref="fileInput"
      type="file"
      :accept="accept"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      @change="onFile"
    />
    <Button
      type="button"
      variant="secondary"
      size="sm"
      :disabled="isUploading || disabled"
      @click="fileInput?.click()"
    >
      {{ isUploading ? 'Uploading…' : label }}
    </Button>
    <Button
      v-if="hasImage"
      type="button"
      variant="ghost"
      size="sm"
      :disabled="isUploading || disabled"
      @click="emit('remove')"
    >
      Remove
    </Button>
  </div>
</template>
