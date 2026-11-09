import type { ViewColor, ViewIcon } from '@linear/contract'
import { Bookmark, Bug, Flag, Inbox, Layers, List, Star, Target, Zap } from '@lucide/vue'
import type { Component } from 'vue'

export const VIEW_ICON_COMPONENTS: Record<ViewIcon, Component> = {
  layers: Layers,
  list: List,
  star: Star,
  zap: Zap,
  bug: Bug,
  flag: Flag,
  target: Target,
  inbox: Inbox,
  bookmark: Bookmark,
}

/** Semantic tokens only (docs/design.md); the stored value is the token key, never hex. */
export const VIEW_COLOR_CLASSES: Record<ViewColor, string> = {
  neutral: 'text-ink-subtle',
  started: 'text-status-started',
  completed: 'text-status-completed',
  success: 'text-success',
  urgent: 'text-priority-urgent',
}

export const VIEW_COLOR_LABELS: Record<ViewColor, string> = {
  neutral: 'Gray',
  started: 'Yellow',
  completed: 'Lavender',
  success: 'Green',
  urgent: 'Red',
}
