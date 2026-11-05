import './lib/random-uuid-polyfill'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { queryClient } from './lib/query-client'
import { router } from './router'
import './styles/globals.css'

createApp(App).use(createPinia()).use(VueQueryPlugin, { queryClient }).use(router).mount('#app')
