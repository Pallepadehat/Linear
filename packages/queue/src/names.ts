export const QUEUE_NAMES = {
  githubWebhooks: 'github-webhooks',
  media: 'media',
  maintenance: 'maintenance',
  notifications: 'notifications',
} as const

export type QueueKey = keyof typeof QUEUE_NAMES
