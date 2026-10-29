import { fileURLToPath, URL } from 'node:url'
import { loadAppEnv } from '@linear/env/app'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig(({ mode }) => {
  // One .env at the repo root; only VITE_* keys are exposed to the browser.
  const env = loadAppEnv(loadEnv(mode, repoRoot, 'VITE_'))
  const apiTarget = `http://localhost:${process.env.PORT ?? 3000}`

  return {
    envDir: repoRoot,
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      strictPort: true,
      // Same-origin in dev so Better Auth cookies are first-party (PRD §8.5).
      proxy: env.VITE_API_URL
        ? undefined
        : {
            '/api': { target: apiTarget, changeOrigin: false },
            '/rpc': { target: apiTarget, changeOrigin: false },
          },
    },
  }
})
