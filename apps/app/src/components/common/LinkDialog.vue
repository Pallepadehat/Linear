<script setup lang="ts">
import { linkFieldsSchema, type LinkFields } from '@linear/contract'
import { useForm } from 'vee-validate'
import { ref, watch } from 'vue'
import FormField from '@/components/common/FormField.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { errorMessage } from '@/lib/errors'
import { toTypedSchema } from '@/lib/form-schema'

/**
 * The add / edit web link form shared by issue and project resources. `save` resolves to
 * close the dialog; a rejection shows its message in the form.
 */
const props = defineProps<{
  /** The link being edited; empty to add one. */
  link?: { url: string; title: string; hostname: string } | null
  /** Screen-reader description, e.g. "A web link shown in the issue's resources." */
  description: string
  save: (fields: LinkFields) => Promise<unknown> | void
}>()
const open = defineModel<boolean>('open', { required: true })

const formError = ref<string | null>(null)
const { handleSubmit, isSubmitting, resetForm } = useForm({
  validationSchema: toTypedSchema(linkFieldsSchema),
})

watch(open, (isOpen) => {
  if (!isOpen) return
  formError.value = null
  // A title equal to the hostname is the default; leave the field empty so it follows the URL.
  const title = props.link && props.link.title !== props.link.hostname ? props.link.title : ''
  resetForm({ values: { url: props.link?.url ?? '', title } })
})

const onSubmit = handleSubmit(async (fields) => {
  formError.value = null
  try {
    await props.save(fields)
    open.value = false
  } catch (error) {
    formError.value = errorMessage(error)
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="gap-0 rounded-xl border-hairline bg-floating p-0 sm:max-w-md">
      <form novalidate class="flex flex-col" @submit="onSubmit">
        <div class="grid gap-1 px-5 pt-4">
          <DialogTitle class="text-[15px] font-semibold text-ink">
            {{ link ? 'Edit link' : 'Add link' }}
          </DialogTitle>
          <DialogDescription class="sr-only">{{ description }}</DialogDescription>
        </div>
        <div class="grid gap-3 px-5 pt-4">
          <FormField
            name="url"
            label="URL"
            type="url"
            placeholder="https://…"
            autocomplete="off"
            autofocus
          />
          <FormField
            name="title"
            label="Title (optional)"
            placeholder="Defaults to the site name"
            autocomplete="off"
          />
        </div>
        <div class="flex items-center gap-3 px-5 pt-4 pb-4">
          <p v-if="formError" class="text-[13px] text-danger" role="alert">{{ formError }}</p>
          <Button type="button" variant="ghost" size="sm" class="ml-auto" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" size="sm" :disabled="isSubmitting">
            {{ link ? 'Save' : 'Add link' }}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
