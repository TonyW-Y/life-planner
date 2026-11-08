import { useEffect } from 'react'
import { db } from '../../data/db'
import { supabase } from '../../data/supabase'
import { remindersBetween } from '../../lib/reminders'
import { notify } from '../../lib/notify'
import { toast } from '../../lib/toast'
import { pupsReact } from '../../lib/pupBus'

const FIRED = 'reminders:fired'
const LAST = 'reminders:lastCheck'

/** While the app is open (or in a background tab), fire reminders on time. Push covers it when closed. */
export function ReminderEngine() {
  useEffect(() => {
    const check = async () => {
      const now = Date.now()
      const last = ((await db.drafts.get(LAST))?.value as number | undefined) ?? now - 60000
      // catch up on anything missed while asleep, but never more than 2 hours back
      const from = Math.max(last, now - 2 * 3600000)
      const fired = new Set(((await db.drafts.get(FIRED))?.value as string[] | undefined) ?? [])
      const events = await db.events.filter((e) => !e.deleted && e.reminderMins !== null && e.reminderMins !== undefined).toArray()
      const tasks = await db.tasks.filter((t) => !t.deleted && !t.done && !!t.reminderAt).toArray()
      for (const r of remindersBetween(events, tasks, from, now + 1000)) {
        if (fired.has(r.key)) continue
        fired.add(r.key)
        toast(`${r.title} — ${r.body}`, { emoji: '🔔' })
        pupsReact('happy')
        // when push is set up the server sends it; avoid a double notification
        const hasPush = !!supabase && !!(await navigator.serviceWorker?.getRegistration())?.pushManager && !!(await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription())
        if (!hasPush || document.visibilityState === 'visible') void notify(r.title, r.body, { tag: r.key, url: r.url })
      }
      await db.drafts.bulkPut([
        { key: FIRED, value: [...fired].slice(-500), at: now },
        { key: LAST, value: now, at: now },
      ])
    }
    void check()
    const t = setInterval(check, 20000)
    const onVis = () => document.visibilityState === 'visible' && void check()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])
  return null
}
