<script setup lang="ts">
import { useField } from 'vee-validate'
import { useId } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const props = defineProps<{
  name: string
  label: string
  type?: string
  autocomplete?: string
  placeholder?: string
  hint?: string
  mono?: boolean
  autofocus?: boolean
}>()

const id = useId()
const { value, errorMessage, handleBlur } = useField<string>(() => props.name)
</script>

<template>
  <div class="grid gap-1.5">
    <Label :for="id" class="text-ink-muted">{{ label }}</Label>
    <slot :id="id" name="input" :value="value" :invalid="Boolean(errorMessage)">
      <Input
        :id="id"
        v-model="value"
        :type="type ?? 'text'"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :autofocus="autofocus"
        :aria-invalid="Boolean(errorMessage)"
        :aria-describedby="errorMessage || hint ? `${id}-help` : undefined"
        :class="cn(mono && 'font-mono')"
        @blur="handleBlur"
      />
    </slot>
    <p v-if="errorMessage" :id="`${id}-help`" class="text-xs text-danger" role="alert">
      {{ errorMessage }}
    </p>
    <p v-else-if="hint" :id="`${id}-help`" class="text-xs text-ink-subtle">{{ hint }}</p>
  </div>
</template>
