/**
 * Copies text. `navigator.clipboard` only exists in secure contexts (https or localhost), so over
 * plain http on a LAN address fall back to the legacy `execCommand('copy')` on a hidden textarea.
 */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard) return navigator.clipboard.writeText(text)
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.append(area)
  area.select()
  try {
    if (!document.execCommand('copy')) throw new Error('copy command was refused')
  } finally {
    area.remove()
  }
}
