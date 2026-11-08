import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, format, startOfDay, startOfWeek } from 'date-fns'
import { useState } from 'react'
import { db } from '../../../data/db'
import { fmtD } from '../../../lib/recurrence'
import { retention, streak } from '../../../lib/stats'
import { isNew } from '../../../lib/srs'

const hm = (mins: number) => (mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60 ? `${mins % 60}m` : ''}`.trim() : `${mins}m`)

function Tile({ big, label, sub }: { big: string; label: string; sub?: string }) {
  return (
    <div className="card flex flex-col gap-0.5">
      <div className="text-sm font-bold text-muted">{label}</div>
      <div className="text-3xl font-extrabold tabular-nums">{big}</div>
      {sub && <div className="text-xs font-semibold text-muted">{sub}</div>}
    </div>
  )
}

/** Single-series vertical bars with hover/tap tooltips. */
function ColumnChart({ data, color = 'var(--primary)', unit }: { data: { label: string; value: number; tip: string; highlight?: boolean }[]; color?: string; unit: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="relative">
      <div className="flex h-40 items-end gap-1.5 border-b border-line" role="img" aria-label={data.map((d) => `${d.label}: ${d.tip}`).join(', ')}>
        {data.map((d, i) => (
          <div
            key={i}
            className="relative flex h-full flex-1 cursor-default items-end justify-center"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => setHover(hover === i ? null : i)}
          >
            <div
              className="w-full max-w-9 rounded-t-[4px] transition-all"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0, background: color, opacity: hover === null || hover === i ? 1 : 0.55 }}
            />
            {hover === i && (
              <div className="absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-xl border border-line bg-surface px-2 py-1 text-xs font-bold shadow-soft">
                {d.tip}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {data.map((d, i) => (
          <div key={i} className={`flex-1 text-center text-[11px] font-bold ${d.highlight ? 'text-ink' : 'text-muted'}`}>
            {d.label}
          </div>
        ))}
      </div>
      <div className="mt-1 text-right text-[11px] font-semibold text-muted">max {unit(max)}</div>
    </div>
  )
}

export function StatsPage() {
  const sessions = useLiveQuery(() => db.sessions.filter((s) => !s.deleted).toArray(), [], [])
  const reviews = useLiveQuery(() => db.reviews.filter((r) => !r.deleted).toArray(), [], [])
  const cards = useLiveQuery(() => db.cards.filter((c) => !c.deleted && !c.suspended).toArray(), [], [])

  const today = startOfDay(new Date())
  const wk = startOfWeek(today, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(wk, i))
  const minsOn = (d: Date) => sessions.filter((s) => fmtD(new Date(s.start)) === fmtD(d)).reduce((a, s) => a + s.focusMins, 0)
  const weekSessions = sessions.filter((s) => s.start >= wk.getTime())
  const weekMins = weekSessions.reduce((a, s) => a + s.focusMins, 0)
  const lastWeekMins = sessions.filter((s) => s.start >= addDays(wk, -7).getTime() && s.start < wk.getTime()).reduce((a, s) => a + s.focusMins, 0)

  const bySubject = new Map<string, number>()
  for (const s of weekSessions) bySubject.set(s.subject, (bySubject.get(s.subject) ?? 0) + s.focusMins)
  const subjects = [...bySubject.entries()].sort((a, b) => b[1] - a[1])
  const subjMax = Math.max(1, ...subjects.map((s) => s[1]))

  const active = new Set([...sessions.map((s) => fmtD(new Date(s.start))), ...reviews.map((r) => fmtD(new Date(r.at)))])
  const st = streak(active)
  const monthAgo = Date.now() - 30 * 86400000
  const ret = retention(reviews.filter((r) => r.at >= monthAgo).map((r) => r.rating))
  const reviewsToday = reviews.filter((r) => r.at >= today.getTime()).length

  const forecast = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i)
    const end = addDays(d, 1).getTime()
    const n = cards.filter((c) => !isNew(c.srs) && new Date(c.srs.due).getTime() < end && (i === 0 || new Date(c.srs.due).getTime() >= d.getTime())).length
    return { label: i === 0 ? 'Today' : format(d, 'EEE'), value: n, tip: `${format(d, 'EEE MMM d')}: ${n} card${n === 1 ? '' : 's'} due`, highlight: i === 0 }
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="This week" big={hm(weekMins)} sub={lastWeekMins ? `last week ${hm(lastWeekMins)}` : 'of focused study'} />
        <Tile label="Streak" big={`${st.days} 🔥`} sub={st.frozeDays.length ? `🧊 ${st.frozeDays.length} rest day${st.frozeDays.length === 1 ? '' : 's'} forgiven` : '1 rest day a week is free'} />
        <Tile label="Cards today" big={`${reviewsToday}`} sub={`${reviews.length} reviews all-time`} />
        <Tile label="Remembered" big={ret === null ? '—' : `${Math.round(ret * 100)}%`} sub="of reviews, last 30 days" />
      </div>

      <div className="card">
        <div className="h2 mb-3">Focus this week</div>
        <ColumnChart
          unit={hm}
          data={weekDays.map((d) => {
            const v = minsOn(d)
            return { label: format(d, 'EEEEE'), value: v, tip: `${format(d, 'EEE MMM d')}: ${hm(v)}`, highlight: fmtD(d) === fmtD(today) }
          })}
        />
      </div>

      <div className="card">
        <div className="h2 mb-3">By subject this week</div>
        {subjects.length ? (
          <div className="flex flex-col gap-2">
            {subjects.slice(0, 10).map(([name, mins]) => (
              <div key={name} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3" title={`${name}: ${hm(mins)}`}>
                <span className="truncate text-sm font-bold">{name}</span>
                <div className="h-3 rounded-full bg-surface-2">
                  <div className="h-3 rounded-full bg-accent" style={{ width: `${(mins / subjMax) * 100}%` }} />
                </div>
                <span className="text-sm font-bold tabular-nums text-muted">{hm(mins)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-muted">Start a focus timer and your subjects show up here 🌱</p>
        )}
      </div>

      <div className="card">
        <div className="h2 mb-1">Cards coming up</div>
        <p className="mb-3 text-sm text-muted">Reviews due each day this week, so you can plan lighter days 🃏</p>
        <ColumnChart unit={(v) => `${v} cards`} color="var(--cat-clinical)" data={forecast} />
      </div>
    </div>
  )
}
