/** API origin. Empty VITE_API_URL means same origin (Vite proxy in dev, one domain in prod). */
export const apiBase = import.meta.env.VITE_API_URL || window.location.origin
