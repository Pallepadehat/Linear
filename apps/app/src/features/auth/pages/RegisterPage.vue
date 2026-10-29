<script setup lang="ts">
import RegisterForm from '../components/RegisterForm.vue'
</script>

<template>
  <div class="grid gap-6">
    <h1 class="text-center text-xl font-semibold tracking-tight text-ink">Create your account</h1>
    <RegisterForm />
    <p class="text-center text-ink-subtle">
      Already have an account?
      <RouterLink :to="{ name: 'login' }" class="font-medium text-primary hover:underline"
        >Log in</RouterLink
      >
    </p>
  </div>
</template>
