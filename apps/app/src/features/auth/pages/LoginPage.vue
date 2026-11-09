<script setup lang="ts">
import LoginForm from '../components/LoginForm.vue'
</script>

<template>
  <div class="grid gap-6">
    <h1 class="text-center text-xl font-semibold tracking-tight text-ink">Log in</h1>
    <LoginForm />
    <p class="text-center text-ink-subtle">
      No account yet?
      <RouterLink :to="{ name: 'register' }" class="font-medium text-link hover:underline"
        >Sign up</RouterLink
      >
    </p>
  </div>
</template>
