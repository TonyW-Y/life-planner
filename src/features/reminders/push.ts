import { supabase } from '../../data/supabase'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

const b64ToBytes = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export const pushAvailable = () => !!supabase && !!VAPID && 'serviceWorker' in navigator && 'PushManager' in window

/** Subscribe this device to free web push so reminders arrive even when the app is closed. */
export async function ensurePushSubscription() {
  if (!pushAvailable() || Notification.permission !== 'granted') return false
  const { data } = await supabase!.auth.getSession()
  if (!data.session) return false
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID!) }))
  const { error } = await supabase!.from('push_subscriptions').upsert({
    endpoint: sub.endpoint,
    subscription: sub.toJSON(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
  return !error
}
