/** Show a system notification if allowed (works while the app is open or in the background). */
export async function notify(title: string, body: string, opts: { tag?: string; url?: string } = {}) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, { body, icon: '/icon.svg', badge: '/icon.svg', tag: opts.tag, data: { url: opts.url ?? '/' } })
    else new Notification(title, { body, icon: '/icon.svg', tag: opts.tag })
    return true
  } catch {
    return false
  }
}

export async function askNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported' as const
  if (Notification.permission === 'default') return Notification.requestPermission()
  return Notification.permission
}
