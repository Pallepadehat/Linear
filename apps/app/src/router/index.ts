import { createRouter, createWebHistory } from 'vue-router'
import { installGuards } from './guards'
import { routes } from './routes'

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

installGuards(router)
