import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, addWeeks, format, isSunday, startOfDay, startOfWeek } from 'date-fns'
import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, save } from '../../data/db'
import type { Budget, CalEvent, Mood, StudySession } from '../../data/types'
import { createEvent } from '../../data/actions'
import { BUDGET_CATS, DEFAULT_ALLOC, DEFAULT_FIXED, FIXED_CATEGORIES, bucketFor, overBy, parseNeed, weekBreakdown, type BudgetCat } from '../../lib/budget'
import { expandEvents, fmtD, fmtDT } from '../../lib/recurrence'
import { DEFAULT_AWAKE, findTime, type Awake, type Interval } from '../../lib/slots'
import { guessCategory } from '../../lib/quickAdd'
import { toast } from '../../lib/toast'
import { useSetting } from '../../lib/useSetting'
import { pupsReact } from '../../lib/pupBus'

const h1 = (n: number) => (Math.round(n * 10) / 10).toString()
const MOOD_EMOJI = ['', '😢', '😕', '😐', '🙂', '🥰']

export function BudgetPage() {
  const [week, setWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const wkId = fmtD(week)
  const weekEnd = addDays(week, 7)
  const [awake, setAwake] = useSetting<Awake>('awake', DEFAULT_AWAKE)

  const stored = useLiveQuery(() => db.budgets.get(wkId), [wkId])
  const previous = useLiveQuery(() => db.budgets.where('id').below(wkId).last(), [wkId])
  const budget: Pick<Budget, 'fixed' | 'alloc' | 'review'> = stored ?? { fixed: previous?.fixed ?? DEFAULT_FIXED, alloc: previous?.alloc ?? DEFAULT_ALLOC, review: {} }
  const patch = (p: Partial<Budget>) => save<Budget>('budgets', { id: wkId, fixed: budget.fixed, alloc: budget.alloc, review: budget.review, ...p })

  const events = useLiveQuery(() => db.events.filter((e) => !e.deleted).toArray(), [], [] as CalEvent[])
  const sessions = useLiveQuery(() => db.sessions.where('start').between(week.getTime(), weekEnd.getTime()).filter((s) => !s.deleted).toArray(), [wkId], [] as StudySession[])
  const moods = useLiveQuery(() => db.moods.where('date').between(wkId, fmtD(weekEnd)).filter((m) => !m.deleted).sortBy('at'), [wkId], [] as Mood[])
  const occ = useMemo(() => expandEvents(events, week, weekEnd).filter((o) => !o.event.allDay), [events, wkId]) // eslint-disable-line react-hooks/exhaustive-deps

  const hours = (o: { start: Date; end: Date }) => (o.end.getTime() - o.start.getTime()) / 3600000
  const fixedOcc = occ.filter((o) => FIXED_CATEGORIES.includes(o.event.category))
  const fixedByCat = FIXED_CATEGORIES.map((c) => ({ c, h: fixedOcc.filter((o) => o.event.category === c).reduce((a, o) => a + hours(o), 0) }))
  const bd = weekBreakdown(awake, budget.fixed, fixedOcc.reduce((a, o) => a + hours(o), 0))
  const over = overBy(budget.alloc, bd.free)
  const allocated = Object.values(budget.alloc).reduce((a, b) => a + b, 0)

  const now = new Date()
  const planned = (cat: BudgetCat) => occ.filter((o) => bucketFor(o.event.category, o.event.title) === cat).reduce((a, o) => a + hours(o), 0)
  const done = (cat: BudgetCat) => {
    const past = occ.filter((o) => bucketFor(o.event.category, o.event.title) === cat && o.end <= now)
    if (cat === 'study') return Math.max(sessions.reduce((a, s) => a + s.focusMins, 0) / 60, past.reduce((a, o) => a + hours(o), 0))
    return past.reduce((a, o) => a + hours(o), 0)
  }

  const isThisWeek = fmtD(startOfWeek(new Date(), { weekStartsOn: 1 })) === wkId
  const R = 70
  const C = 2 * Math.PI * R

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="h1 mr-auto">My Time ⏳</h1>
        <button className="icon-btn" aria-label="Previous week" onClick={() => setWeek(addWeeks(week, -1))}>‹</button>
        <button className="chip" onClick={() => setWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
          {isThisWeek ? 'This week' : `${format(week, 'MMM d')} – ${format(addDays(week, 6), 'MMM d')}`}
        </button>
        <button className="icon-btn" aria-label="Next week" onClick={() => setWeek(addWeeks(week, 1))}>›</button>
      </div>

      {/* Hero */}
      <div className="card flex flex-col items-center gap-4 sm:flex-row">
        <div className="relative shrink-0">
          <svg width={2 * R + 24} height={2 * R + 24} className="-rotate-90" role="img" aria-label={`${h1(bd.free)} free hours out of 168`}>
            <circle cx={R + 12} cy={R + 12} r={R} fill="none" stroke="var(--surface-2)" strokeWidth="16" />
            <motion.circle cx={R + 12} cy={R + 12} r={R} fill="none" stroke="var(--primary)" strokeWidth="16" strokeLinecap="round" strokeDasharray={C} animate={{ strokeDashoffset: C * (1 - bd.free / 168) }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-extrabold">{Math.round(bd.free)}</div>
            <div className="text-xs font-bold text-muted">free hours</div>
          </div>
        </div>
        <div className="flex-1">
          <div className="text-2xl font-extrabold">You have {Math.round(bd.free)} hours that are yours this week 🐾</div>
          <p className="mt-1 text-sm font-semibold text-muted">That's what's left of 168 hours after sleep, daily life, and things you can't move. About {h1(bd.free / 7)} h a day.</p>
          <table className="mt-2 text-sm">
            <tbody>
              <tr><td className="pr-4 font-bold text-muted">😴 Sleep</td><td className="font-extrabold tabular-nums">{h1(bd.sleep)} h</td></tr>
              <tr><td className="pr-4 font-bold text-muted">🎓 Classes, clinicals & exams</td><td className="font-extrabold tabular-nums">{h1(bd.scheduled)} h</td></tr>
              <tr><td className="pr-4 font-bold text-muted">🍳 Commute, meals, getting ready</td><td className="font-extrabold tabular-nums">{h1(bd.living)} h</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Step 1 */}
        <div className="card flex flex-col gap-3">
          <div className="h2">1 · The fixed stuff</div>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="label">⏰ Wake up</span>
              <input type="time" className="input" value={awake.wake} onChange={(e) => setAwake({ ...awake, wake: e.target.value })} />
            </label>
            <label>
              <span className="label">🌙 Bedtime</span>
              <input type="time" className="input" value={awake.bed} onChange={(e) => setAwake({ ...awake, bed: e.target.value })} />
            </label>
          </div>
          {(
            [
              ['commuteDaily', '🚗 Commute (h/day)'],
              ['mealsDaily', '🍳 Meals (h/day)'],
              ['selfCareDaily', '🛁 Getting ready (h/day)'],
            ] as const
          ).map(([k, label]) => (
            <Stepper key={k} label={label} value={budget.fixed[k]} step={0.25} onChange={(v) => patch({ fixed: { ...budget.fixed, [k]: v } })} />
          ))}
          <div className="rounded-2xl bg-surface-2 p-3 text-sm">
            <div className="font-bold">From your calendar this week</div>
            {fixedByCat.map(({ c, h }) => (
              <div key={c} className="flex justify-between font-semibold text-muted">
                <span>{c === 'lecture' ? '🎓 Lectures' : c === 'clinical' ? '🩺 Clinicals' : '📝 Exams'}</span>
                <span className="tabular-nums">{h1(h)} h</span>
              </div>
            ))}
            <Link to="/calendar?v=week" className="mt-1 inline-block font-bold text-primary underline">Add classes or rotations on the calendar →</Link>
          </div>
        </div>

        {/* Step 2 */}
        <div className="card flex flex-col gap-3">
          <div className="h2">2 · Share out your {Math.round(bd.free)} hours</div>
          {BUDGET_CATS.map((c) => (
            <label key={c.id} className="flex flex-col gap-1">
              <span className="flex items-center justify-between text-sm font-bold">
                <span>
                  {c.emoji} {c.label} <span className="font-semibold text-muted">· {c.hint}</span>
                </span>
                <span className="tabular-nums">{h1(budget.alloc[c.id] ?? 0)} h</span>
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(40, Math.ceil(bd.free))}
                step={0.5}
                value={budget.alloc[c.id] ?? 0}
                onChange={(e) => patch({ alloc: { ...budget.alloc, [c.id]: +e.target.value } })}
                className="accent-[var(--primary)]"
              />
            </label>
          ))}
          <div className={`rounded-2xl p-3 text-sm font-bold ${over > 0 ? 'bg-warn-soft' : 'bg-accent-soft'}`}>
            <div className="mb-1 h-2.5 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (allocated / Math.max(1, bd.free)) * 100)}%`, background: over > 0 ? 'var(--warn)' : 'var(--accent)' }} />
            </div>
            {over > 0
              ? `That's ${h1(over)} h more than you have 💛 Want to trim something? It's okay not to do it all.`
              : `${h1(allocated)} of ${Math.round(bd.free)} h planned · ${h1(-over)} h of breathing room ☁️`}
          </div>
        </div>
      </div>

      {/* Planned vs done */}
      <div className="card flex flex-col gap-3">
        <div className="h2">How the week is going</div>
        {BUDGET_CATS.map((c) => {
          const goal = budget.alloc[c.id] ?? 0
          const d = done(c.id)
          const p = planned(c.id)
          return (
            <div key={c.id} className="grid grid-cols-[minmax(0,8.5rem)_1fr] items-center gap-3">
              <span className="truncate text-sm font-bold">{c.emoji} {c.label}</span>
              <div title={`${h1(d)} h done · ${h1(p)} h on calendar · goal ${h1(goal)} h`}>
                <div className="h-3 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${goal ? Math.min(100, (d / goal) * 100) : 0}%` }} />
                </div>
                <div className="mt-0.5 text-xs font-semibold text-muted">
                  {h1(d)} of {h1(goal)} h done · {h1(p)} h on calendar {d >= goal && goal > 0 ? '🎉' : ''}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <FindTime awake={awake} occ={occ} week={week} />

      {/* Weekly review */}
      <div className={`card flex flex-col gap-3 ${isSunday(new Date()) && isThisWeek ? '!border-primary ring-2 ring-primary-soft' : ''}`}>
        <div className="h2">🌙 Weekly check-in {isSunday(new Date()) && isThisWeek ? '— it’s Sunday!' : ''}</div>
        {moods.length > 0 && (
          <div className="flex items-center gap-2 text-sm font-bold text-muted">
            Mood this week: <span className="text-2xl">{moods.map((m) => MOOD_EMOJI[m.mood]).join(' ')}</span>
          </div>
        )}
        {(
          [
            ['wins', '🌟 What went well? (big or tiny)'],
            ['hard', '🌧️ What was hard?'],
            ['next', '🌱 One thing to try next week'],
          ] as const
        ).map(([k, label]) => (
          <label key={k}>
            <span className="label">{label}</span>
            <textarea className="input min-h-16" defaultValue={budget.review?.[k] ?? ''} key={wkId + k + !!stored} onChange={(e) => patch({ review: { ...budget.review, [k]: e.target.value } })} />
          </label>
        ))}
        <button
          className="btn-soft self-start"
          onClick={async () => {
            await save<Budget>('budgets', { id: fmtD(addWeeks(week, 1)), fixed: budget.fixed, alloc: budget.alloc, review: {} })
            pupsReact('happy')
            toast('Next week has the same plan 🐾', { emoji: '📋' })
          }}
        >
          📋 Use this plan for next week too
        </button>
      </div>
    </div>
  )
}

function Stepper({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-bold">{label}</span>
      <div className="flex items-center gap-1">
        <button className="icon-btn !h-9 !w-9 bg-surface-2" aria-label="Less" onClick={() => onChange(Math.max(0, value - step))}>−</button>
        <span className="w-12 text-center font-extrabold tabular-nums">{value}</span>
        <button className="icon-btn !h-9 !w-9 bg-surface-2" aria-label="More" onClick={() => onChange(value + step)}>+</button>
      </div>
    </div>
  )
}

function FindTime({ awake, occ, week }: { awake: Awake; occ: { start: Date; end: Date }[]; week: Date }) {
  const [text, setText] = useState('')
  const [chunk, setChunk] = useState(90)
  const [plan, setPlan] = useState<Interval[] | null>(null)
  const need = parseNeed(text)
  const run = () => {
    if (!need) return
    const today = startOfDay(new Date())
    const days = Array.from({ length: 7 }, (_, i) => addDays(week, i)).filter((d) => d >= today)
    setPlan(findTime(need.mins, days, awake, occ, { maxChunk: chunk, now: new Date() }))
  }
  const got = plan?.reduce((a, p) => a + (p.end.getTime() - p.start.getTime()) / 60000, 0) ?? 0
  return (
    <div className="card flex flex-col gap-3">
      <div className="h2">🔎 Find time</div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          run()
        }}
      >
        <input className="input min-w-0 flex-1" value={text} onChange={(e) => { setText(e.target.value); setPlan(null) }} placeholder="e.g. “I need 3h for pharm review”" />
        <select className="input !w-auto" value={chunk} onChange={(e) => setChunk(+e.target.value)} aria-label="Longest block">
          <option value={30}>30 min blocks</option>
          <option value={60}>1 h blocks</option>
          <option value={90}>1.5 h blocks</option>
          <option value={120}>2 h blocks</option>
        </select>
        <button className="btn-primary" disabled={!need}>Find</button>
      </form>
      {plan && (
        <div className="flex flex-col gap-2">
          {plan.length ? (
            <>
              <div className="text-sm font-bold text-muted">
                {got >= (need?.mins ?? 0) ? 'Found it! Here’s a cozy spread:' : `Only found ${h1(got / 60)} h this week — it’s a full one 💛`}
              </div>
              {plan.map((p, i) => (
                <div key={i} className="rounded-2xl bg-surface-2 px-3 py-2 font-bold">
                  {format(p.start, 'EEE MMM d · h:mm')}–{format(p.end, 'h:mm a')}
                </div>
              ))}
              <button
                className="btn-primary self-start"
                onClick={async () => {
                  const cat = guessCategory(need!.what)
                  for (const p of plan) await createEvent({ title: need!.what, start: fmtDT(p.start), end: fmtDT(p.end), category: cat === 'other' ? 'study' : cat, reminderMins: 10 })
                  toast(`Added ${plan.length} block${plan.length === 1 ? '' : 's'} to your calendar ✨`, { emoji: '🧩' })
                  setPlan(null)
                  setText('')
                }}
              >
                Put them on my calendar
              </button>
            </>
          ) : (
            <div className="text-sm font-bold text-muted">No free time left this week 😮‍💨 — maybe next week, or trim something?</div>
          )}
        </div>
      )}
    </div>
  )
}
