/* global localStorage, matchMedia, document */
// Apply the theme before first paint (no flash). Mirrors useTheme(): key "theme", "auto" = system.
// A classic blocking script (not inline) so the Content-Security-Policy can be script-src 'self'.
;(function () {
  try {
    var mode = localStorage.getItem('theme') || 'auto'
    var dark =
      mode === 'dark' || (mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
  } catch {
    // Storage blocked (private mode): the app applies the theme after load.
  }
})()
