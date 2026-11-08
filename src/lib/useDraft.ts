import { useCallback, useEffect, useRef, useState } from 'react'
import { clearDraft, loadDraft, saveDraft } from '../data/db'
import { registerFlush } from './lifecycle'

/**
 * State that autosaves to IndexedDB as you type (debounced) and is flushed
 * immediately when the app is hidden or closed, so half-typed things survive.
 */
export function useDraft<T>(key: string | null, initial: T) {
  const [value, setValue] = useState<T>(initial)
  const [restored, setRestored] = useState(false)
  const pending = useRef<T | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    let alive = true
    setRestored(false)
    if (!key) {
      setRestored(true)
      return
    }
    loadDraft<T>(key).then((d) => {
      if (!alive) return
      if (d !== undefined) setValue(d)
      setRestored(true)
    })
    return () => {
      alive = false
    }
  }, [key])

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    if (key && pending.current !== null) {
      const v = pending.current
      pending.current = null
      await saveDraft(key, v)
    }
  }, [key])

  useEffect(() => {
    const off = registerFlush(flush)
    return () => {
      off()
      void flush()
    }
  }, [flush])

  const update = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v
        pending.current = next
        clearTimeout(timer.current)
        timer.current = setTimeout(() => void flush(), 250)
        return next
      })
    },
    [flush],
  )

  const discard = useCallback(async () => {
    clearTimeout(timer.current)
    pending.current = null
    if (key) await clearDraft(key)
  }, [key])

  return { value, setValue: update, discard, restored }
}
