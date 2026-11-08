import { maybeSnapshot, purgeTrash, requestPersistence } from '../data/db'

type Flusher = () => void | Promise<void>
const flushers = new Set<Flusher>()

/** Register something that must be written out when the app is hidden/closed. */
export function registerFlush(fn: Flusher) {
  flushers.add(fn)
  return () => flushers.delete(fn)
}

export async function flushAll() {
  await Promise.allSettled([...flushers].map((f) => f()))
}

let started = false
export function startLifecycle() {
  if (started) return
  started = true
  const onHide = () => {
    void flushAll()
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide()
  })
  window.addEventListener('pagehide', onHide)
  window.addEventListener('beforeunload', onHide)
  void requestPersistence()
  void purgeTrash()
  void maybeSnapshot()
}
