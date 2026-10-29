import { createAuthClient } from 'better-auth/vue'
import { apiBase } from './api-base'

export const authClient = createAuthClient({ baseURL: apiBase })
