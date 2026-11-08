import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, format, isSunday, startOfDay, startOfWeek } from 'date-fns'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../../data/db'
import type { CalEvent, Exam, FlashCard, Task } from '../../data/types'
import { rollOver } from '../../data/actions'
import { PomPals } from '../../features/pups/PomPals'
import { QuickAdd } from '../../features/quickadd/QuickAdd'
import { TaskItem } from '../../features/tasks/TaskItem'
import { TaskEditor } from '../../features/tasks/TaskEditor'
import { EventEditor, type EditorState } from '../../features/calendar/EventEditor'
import { ExamCountdown, daysUntil } from '../../features/study/planner/ExamPlanPage'
import { countCards } from '../../features/study/flashcards/cardActions'
import { catColor, catMeta } from '../../lib/categories'
import { expandEvents, fmtD } from '../../lib/recurrence'
import { useSetting } from '../../lib/useSetting'
import { MOODS, checkInMood } from './TTPage'

function greeting(name: string) {
  const h = new Date().getHours()
  const who = name ? `, ${name}` : ''
  if (h < 5) return `Still up${who}? 🌙`
  if (h < 12) return `Good morning${who} ☀️`
  if (h < 17) return `Good afternoon${who} 🌷`
  if (h < 21) return `Good evening${who} 🌇`
  return `Cozy night${who} 🌙`
}

export function HomePage() {
  const nav = useNavigate()
  const [name] = useSetting('userName', '')
  const today = startOfDay(new Date())
  const tomorrow = addDays(today, 1)
  const events = useLiveQuery(() => db.events.filter((e) => !e.deleted).toArray(), [], [] as CalEvent[])
  const tasks = useLiveQuery(() => db.tasks.filter((t) => !t.deleted).toArray(), [], [] as Task[])
  const cards = useLiveQuery(() => db.cards.filter((c) => !c.deleted).toArray(), [], [] as FlashCard[])
  const exams = useLiveQuery(() => db.exams.filter((e) => !e.deleted).sortBy('date'), [], [] as Exam[])
  const mood = useLiveQuery(() => db.moods.where('date').equals(fmtD(today)).filter((m) => !m.deleted).last(), [])
  const weekMins = useLiveQuery(
    async () => (await db.sessions.where('start').aboveOrEqual(startOfWeek(today, { weekStartsOn: 1 }).getTime()).filter((s) => !s.deleted).toArray()).reduce((a, s) => a + s.focusMins, 0),
    [],
    0,
  )
  const budget = useLiveQuery(() => db.budgets.get(fmtD(startOfWeek(today, { weekStartsOn: 1 }))), [])
  const [taskOpen, setTaskOpen] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState>(null)

  const occ = useMemo(() => expandEvents(events, today, tomorrow), [events]) // eslint-disable-line react-hooks/exhaustive-deps
  const now = new Date()
  const nextUp = occ.find((o) => !o.event.allDay && o.end > now)
  const todayStr = fmtD(today)
  const todays = tasks.filter((t) => !t.done && t.due === todayStr)
  const overdue = tasks.filter((t) => !t.done && t.due && t.due < todayStr)
  const doneToday = tasks.filter((t) => t.done && t.doneAt && t.doneAt >= today.getTime()).length
  const cc = countCards(cards)
  const nextExam = exams.find((e) => daysUntil(e.date) >= 0)
  const studyGoal = (budget?.alloc as Record<string, number> | undefined)?.study

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <div className="text-sm font-bold text-muted">{format(now, 'EEEE, MMMM d')}</div>
          <h1 className="text-3xl font-extrabold tracking-tight">{greeting(name)}</h1>
          <p className="mt-1 font-semibold text-muted">
            {todays.length + occ.length === 0
              ? 'Nothing planned today — a gentle day 🌸'
              : `${occ.length} thing${occ.length === 1 ? '' : 's'} on the calendar · ${todays.length} to-do${todays.length === 1 ? '' : 's'}${doneToday ? ` · ${doneToday} done ✨` : ''}`}
          </p>
        </div>
        <div className="flex justify-center">
          <PomPals size={96} />
        </div>
      </div>

      <QuickAdd placeholder="Add anything… “Anki 8pm daily”, “call mom tomorrow”" />

      {!mood && (
        <div className="card flex flex-wrap items-center gap-3">
          <span className="font-extrabold">How are you feeling today?</span>
          <div className="flex gap-1">
            {MOODS.map((m) => (
              <button key={m.v} title={m.l} aria-label={m.l} onClick={() => checkInMood(m.v)} className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-2xl transition hover:scale-110 active:scale-90">
                {m.e}
              </button>
            ))}
          </div>
        </div>
      )}
      {mood && mood.mood <= 2 && (
        <Link to="/tt" className="card flex items-center gap-3 !bg-primary-soft">
          <span className="text-3xl">🧸</span>
          <span className="font-bold">Rough day? TT is here to listen, and the pups want cuddles. Tap to talk 💛</span>
        </Link>
      )}

      {overdue.length > 0 && (
        <div className="card flex flex-wrap items-center gap-3 !bg-warn-soft">
          <span className="text-xl">💛</span>
          <span className="flex-1 font-bold">{overdue.length} thing{overdue.length === 1 ? '' : 's'} from before still on the list</span>
          <button className="btn-primary !min-h-9" onClick={() => rollOver(overdue)}>Carry over to today</button>
        </div>
      )}

      {isSunday(now) && (
        <Link to="/budget" className="card flex items-center gap-3 !bg-accent-soft">
          <span className="text-3xl">🌙</span>
          <span className="font-bold">It's Sunday — 5-minute weekly check-in and plan next week's time?</span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <section className="card">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="h2">Today</h2>
              <Link to={`/calendar?v=day&d=${todayStr}`} className="text-sm font-bold text-primary">Open day →</Link>
            </div>
            {nextUp && (
              <button onClick={() => setEditor({ mode: 'edit', occ: nextUp })} className="mb-2 flex w-full items-center gap-3 rounded-2xl p-3 text-left" style={{ background: `color-mix(in srgb, ${catColor(nextUp.event.category)} 40%, transparent)` }}>
                <span className="text-2xl">{nextUp.event.emoji || catMeta(nextUp.event.category).emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold uppercase text-muted">{nextUp.start <= now ? 'Happening now' : 'Up next'}</div>
                  <div className="truncate font-extrabold">{nextUp.event.title}</div>
                </div>
                <span className="text-sm font-bold">{format(nextUp.start, 'h:mm a')}</span>
              </button>
            )}
            <div className="flex flex-col gap-1">
              {occ
                .filter((o) => o !== nextUp)
                .map((o) => (
                  <button key={o.event.id + o.key} onClick={() => setEditor({ mode: 'edit', occ: o })} className={`flex items-center gap-3 rounded-2xl px-2 py-1.5 text-left hover:bg-surface-2 ${o.end < now && !o.event.allDay ? 'opacity-50' : ''}`}>
                    <span className="h-6 w-1.5 rounded-full" style={{ background: catColor(o.event.category) }} />
                    <span className="w-16 shrink-0 text-sm font-bold text-muted">{o.event.allDay ? 'All day' : format(o.start, 'h:mm a')}</span>
                    <span className="truncate font-bold">{o.event.emoji} {o.event.title}</span>
                  </button>
                ))}
              {!occ.length && <p className="py-2 text-sm text-muted">Calendar's clear today ☁️</p>}
            </div>
          </section>

          <section className="card">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="h2">To-do today</h2>
              <Link to="/tasks" className="text-sm font-bold text-primary">All →</Link>
            </div>
            <div className="flex flex-col gap-2">
              {todays.slice(0, 6).map((t) => (
                <TaskItem key={t.id} task={t} onOpen={() => setTaskOpen(t.id)} />
              ))}
              {!todays.length && <p className="py-2 text-sm text-muted">{doneToday ? `All done for today — ${doneToday} finished! 🎉` : 'Nothing due today. Add something above if you like 🐾'}</p>}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <button onClick={() => nav('/study/cards/review')} disabled={!cc.due && !cc.fresh} className="card flex items-center gap-3 text-left disabled:opacity-80">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-2xl">🃏</span>
            <div className="flex-1">
              <div className="text-xl font-extrabold">{cc.due} cards due</div>
              <div className="text-sm font-semibold text-muted">{cc.due || cc.fresh ? `${cc.fresh} new waiting · tap to review` : cards.length ? 'All caught up! 🎉' : 'Make your first deck in Study'}</div>
            </div>
          </button>

          <button onClick={() => nav('/study/timer')} className="card flex items-center gap-3 text-left">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-2xl">⏱️</span>
            <div className="flex-1">
              <div className="text-xl font-extrabold">
                {Math.floor(weekMins / 60)}h {weekMins % 60}m{studyGoal ? <span className="text-base text-muted"> / {studyGoal}h</span> : ''}
              </div>
              <div className="text-sm font-semibold text-muted">focused this week · start a session</div>
            </div>
          </button>

          {nextExam ? <ExamCountdown exam={nextExam} onClick={() => nav('/study/plan')} /> : (
            <Link to="/study/plan" className="card flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-2xl">📝</span>
              <span className="font-bold text-muted">Add your next exam for a countdown + study plan</span>
            </Link>
          )}

          <Link to="/tt" className="card flex items-center gap-3 !bg-primary-soft">
            <span className="text-3xl">🧸</span>
            <div>
              <div className="font-extrabold">Talk to TT</div>
              <div className="text-sm font-semibold text-muted">Here for big feelings and small worries</div>
            </div>
          </Link>
        </div>
      </div>

      <TaskEditor taskId={taskOpen} onClose={() => setTaskOpen(null)} />
      <EventEditor state={editor} onClose={() => setEditor(null)} />
    </div>
  )
}
