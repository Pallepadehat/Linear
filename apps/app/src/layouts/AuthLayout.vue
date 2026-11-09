<script setup lang="ts">
import BrandMark from '@/components/common/BrandMark.vue'
</script>

<template>
  <main class="flex min-h-svh flex-col items-center justify-center bg-canvas px-4 py-12">
    <div class="w-full max-w-sm">
      <BrandMark class="mx-auto mb-8 size-10" />
      <RouterView />
    </div>
  </main>
</template>
