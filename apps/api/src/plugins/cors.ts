import cors from '@fastify/cors'
import type { FastifyInstance } from 'fastify'

export async function registerCors(app: FastifyInstance, appUrl: string) {
  // Only matters when the app is served from another origin (VITE_API_URL set);
  // in dev the Vite proxy makes requests same-origin.
  await app.register(cors, { origin: [appUrl], credentials: true })
}
