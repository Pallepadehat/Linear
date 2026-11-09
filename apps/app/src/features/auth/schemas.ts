import { z } from 'zod'

// Better Auth endpoints aren't in the oRPC contract, so their form schemas live here.
export const loginSchema = z.object({
  email: z.email({ message: 'Enter a valid email' }),
  password: z.string().min(1, { message: 'Required' }),
})

export const registerSchema = z.object({
  name: z.string().trim().min(1, { message: 'Required' }).max(80),
  email: z.email({ message: 'Enter a valid email' }),
  password: z.string().min(8, { message: 'At least 8 characters' }).max(128),
})
