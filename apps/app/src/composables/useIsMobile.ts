import { useMediaQuery } from '@vueuse/core'

/**
 * Below Tailwind's `md` (768px) the app switches to its phone layout: the sidebar becomes a
 * drawer, side panels stack under the content and two-pane pages show one pane at a time.
 * Use CSS (`md:`/`max-md:`) where it's enough; this is for layouts that differ in markup.
 */
export const MOBILE_QUERY = '(max-width: 767.98px)'

export function useIsMobile() {
  return useMediaQuery(MOBILE_QUERY)
}
