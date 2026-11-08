// Runs every minute (free pg_cron) and sends web push reminders for events, to-dos,
// and the focus timer — so they arrive even when the app is closed.
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
//   supabase functions deploy send-reminders
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { dueReminders, wallNow, type Due, type Ev, type Tk } from '../_shared/reminders.ts'

const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:cozy@example.com', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

Deno.serve(async (req) => {
  if (req.headers.get('Authorization') !== `Bearer ${SERVICE_KEY}`) return new Response('forbidden', { status: 403 })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE_KEY)
  const { data: subs } = await db.from('push_subscriptions').select('endpoint,user_id,subscription,tz')
  if (!subs?.length) return new Response('no subscribers')

  const now = Date.now()
  let sent = 0
  for (const userId of [...new Set(subs.map((s) => s.user_id))]) {
    const mine = subs.filter((s) => s.user_id === userId)
    const tz = mine[0].tz || 'UTC'
    const { data: rows } = await db
      .from('records')
      .select('tbl,data')
      .eq('user_id', userId)
      .or('tbl.eq.events,tbl.eq.tasks,and(tbl.eq.settings,id.eq.timer)')
    const events = (rows ?? []).filter((r) => r.tbl === 'events').map((r) => r.data as Ev)
    const tasks = (rows ?? []).filter((r) => r.tbl === 'tasks').map((r) => r.data as Tk)
    const w = wallNow(tz, now)
    // a 3-minute look-back window covers cron hiccups; sent_reminders prevents doubles
    const due: Due[] = dueReminders(events, tasks, w - 3 * 60000, w + 30000)

    // focus timer: real timestamps, no time zone needed
    const timer = (rows ?? []).find((r) => r.tbl === 'settings')?.data?.value
    if (timer?.running && timer.durationMs > 0) {
      const ends = timer.segStart + timer.durationMs - timer.elapsedBefore
      if (ends <= now && ends > now - 3 * 60000) {
        const focus = timer.phase === 'focus'
        due.push({
          key: `timer:${timer.segStart}:${timer.phase}`,
          at: ends,
          title: focus ? 'Break time! 🐾' : 'Break over ⏱️',
          body: focus ? `Focus session done${timer.subject ? ` — ${timer.subject}` : ''}. Stretch with the pups!` : 'Ready for another round? You got this.',
          url: '/study/timer',
        })
      }
    }

    for (const r of due) {
      const { data: fresh } = await db.from('sent_reminders').upsert({ key: `${userId}:${r.key}` }, { onConflict: 'key', ignoreDuplicates: true }).select('key')
      if (!fresh?.length) continue // already sent
      for (const s of mine) {
        try {
          await webpush.sendNotification(s.subscription, JSON.stringify({ title: r.title, body: r.body, url: r.url, tag: r.key }))
          sent++
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode
          if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        }
      }
    }
  }
  // tidy up old dedupe keys now and then
  if (new Date(now).getUTCMinutes() === 0) await db.from('sent_reminders').delete().lt('sent_at', new Date(now - 3 * 86400000).toISOString())
  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})
