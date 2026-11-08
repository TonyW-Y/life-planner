import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
import { useMemo, useState } from 'react'
import { db, remove, restore, save } from '../../../data/db'
import type { CalEvent, Exam } from '../../../data/types'
import { createEvent, createTask } from '../../../data/actions'
import { expandEvents, fmtD, fmtDT } from '../../../lib/recurrence'
import { DEFAULT_AWAKE, findTime, type Awake } from '../../../lib/slots'
import { generatePlan, groupByDate } from '../../../lib/studyPlan'
import { toast } from '../../../lib/toast'
import { useDraft } from '../../../lib/useDraft'
import { useSetting } from '../../../lib/useSetting'
import { Sheet } from '../../../ui/Sheet'

export function daysUntil(date: string) {
  return differenceInCalendarDays(parseISO(date), startOfDay(new Date()))
}

export function ExamCountdown({ exam, onClick }: { exam: Exam; onClick?: () => void }) {
  const d = daysUntil(exam.date)
  return (
    <button onClick={onClick} className="card flex w-full items-center gap-3 text-left">
      <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary-soft">
        <span className="text-xl font-extrabold leading-none">{Math.max(0, d)}</span>
        <span className="text-[10px] font-bold uppercase">{d === 1 ? 'day' : 'days'}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-extrabold">
          {exam.emoji ?? '📝'} {exam.name}
        </div>
        <div className="text-sm font-semibold text-muted">
          {format(parseISO(exam.date), 'EEE, MMM d')} · {d === 0 ? 'Today — you are ready 💕' : d < 0 ? 'Done! 🎉' : d <= 3 ? 'Almost there, rest well 🌙' : 'Plenty of time 🌱'}
        </div>
      </div>
    </button>
  )
}

export function ExamPlanPage() {
  const exams = useLiveQuery(() => db.exams.filter((e) => !e.deleted).sortBy('date'), [], [] as Exam[])
  const [editing, setEditing] = useState<Exam | 'new' | null>(null)
  const [planFor, setPlanFor] = useState<Exam | null>(null)
  const upcoming = exams.filter((e) => daysUntil(e.date) >= 0)
  const past = exams.filter((e) => daysUntil(e.date) < 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="card !bg-accent-soft">
        <div className="h2">🗺️ Plan backwards from your exam</div>
        <p className="text-sm font-semibold text-muted">
          Add an exam, list the topics, and I'll spread first passes over the days you have, then schedule reviews 1, 3, 7 and 14 days later — the spacing that makes things stick. One tap adds it all to your to-dos and calendar.
        </p>
      </div>
      <button className="btn-primary self-start" onClick={() => setEditing('new')}>+ Add exam</button>
      <div className="grid gap-3 sm:grid-cols-2">
        {upcoming.map((e) => (
          <div key={e.id} className="flex flex-col gap-2">
            <ExamCountdown exam={e} onClick={() => setEditing(e)} />
            <button className="btn-soft" onClick={() => setPlanFor(e)}>✨ Make a study plan</button>
          </div>
        ))}
      </div>
      {!exams.length && (
        <div className="card py-10 text-center">
          <div className="text-5xl">📝</div>
          <div className="h2 mt-2">No exams yet</div>
          <div className="text-muted">Add your next block exam, shelf, or quiz to see a countdown on your home screen.</div>
        </div>
      )}
      {past.length > 0 && (
        <details>
          <summary className="cursor-pointer font-bold text-muted">Past exams ({past.length}) 🎉</summary>
          <div className="mt-2 flex flex-col gap-2">
            {past.map((e) => (
              <ExamCountdown key={e.id} exam={e} onClick={() => setEditing(e)} />
            ))}
          </div>
        </details>
      )}
      <ExamEditor exam={editing} onClose={() => setEditing(null)} />
      {planFor && <PlanMaker exam={planFor} onClose={() => setPlanFor(null)} />}
    </div>
  )
}

function ExamEditor({ exam, onClose }: { exam: Exam | 'new' | null; onClose: () => void }) {
  const cur = exam && exam !== 'new' ? exam : null
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [emoji, setEmoji] = useState('📝')
  const [loaded, setLoaded] = useState<string | null>(null)
  const key = exam === 'new' ? 'new' : (exam?.id ?? null)
  if (key !== loaded) {
    setLoaded(key)
    setName(cur?.name ?? '')
    setDate(cur?.date ?? fmtD(addDays(new Date(), 21)))
    setEmoji(cur?.emoji ?? '📝')
  }
  return (
    <Sheet
      open={!!exam}
      onClose={onClose}
      title={cur ? 'Edit exam' : 'New exam'}
      footer={
        <>
          {cur && (
            <button
              className="btn-ghost"
              onClick={async () => {
                await remove('exams', cur.id)
                toast(`Removed ${cur.name}`, { emoji: '🗑️', undo: () => restore('exams', cur.id) })
                onClose()
              }}
            >
              🗑️ Delete
            </button>
          )}
          <button
            className="btn-primary ml-auto"
            disabled={!name.trim() || !date}
            onClick={async () => {
              await save<Exam>('exams', { id: cur?.id, name: name.trim(), date, emoji })
              // also put it on the calendar the first time
              if (!cur) await createEvent({ title: name.trim(), emoji, start: `${date}T09:00`, end: `${date}T12:00`, category: 'exam', reminderMins: 1440 })
              onClose()
            }}
          >
            Save
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input className="input !w-16 text-center text-xl" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} aria-label="Emoji" />
          <input className="input font-bold" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cardio block exam, Step 1, IM shelf" />
        </div>
        <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        {!cur && <p className="text-xs font-semibold text-muted">It'll also be added to your calendar (9am–12pm, change it there) with a reminder the day before.</p>}
      </div>
    </Sheet>
  )
}

function PlanMaker({ exam, onClose }: { exam: Exam; onClose: () => void }) {
  const { value: topics, setValue: setTopics, discard } = useDraft(`plan:${exam.id}`, '')
  const [start, setStart] = useState(fmtD(new Date()))
  const [mins, setMins] = useState(60)
  const [reviewMins, setReviewMins] = useState(30)
  const [awake] = useSetting<Awake>('awake', DEFAULT_AWAKE)
  const plan = useMemo(() => generatePlan({ topics: topics.split('\n'), start, exam: exam.date }), [topics, start, exam.date])
  const byDay = groupByDate(plan)
  const len = (k: string) => (k === 'learn' ? mins : k === 'final' ? 120 : reviewMins)
  const label = (p: (typeof plan)[number]) => (p.kind === 'learn' ? `📖 Learn: ${p.topic}` : p.kind === 'final' ? `🏁 ${p.topic}` : `🔁 Review #${p.n}: ${p.topic}`)

  const addTasks = async (block: boolean) => {
    let placed = 0
    const events = await db.events.filter((e) => !e.deleted).toArray()
    const extra: CalEvent[] = []
    for (const p of plan) {
      const t = await createTask({ title: label(p).replace(/^\S+ /, ''), due: p.date, priority: p.kind === 'learn' ? 'must' : 'should', tags: [exam.name.toLowerCase().replace(/\s+/g, '-')], estimateMins: len(p.kind), emoji: p.kind === 'learn' ? '📖' : p.kind === 'final' ? '🏁' : '🔁' })
      if (block) {
        const day = parseISO(p.date)
        const busy = expandEvents([...events, ...extra], day, addDays(day, 1)).filter((o) => !o.event.allDay).map((o) => ({ start: o.start, end: o.end }))
        const slot = findTime(len(p.kind), [day], awake, busy, { maxChunk: len(p.kind), minChunk: len(p.kind), now: new Date() })[0]
        if (slot) {
          const ev = await createEvent({ title: t.title, emoji: t.emoji, start: fmtDT(slot.start), end: fmtDT(slot.end), category: 'study', taskId: t.id, reminderMins: 10 })
          extra.push(ev)
          placed++
        }
      }
    }
    toast(block ? `Added ${plan.length} study sessions — ${placed} placed on your calendar ✨` : `Added ${plan.length} to-dos 📚`, { emoji: '🗺️' })
    await discard()
    onClose()
  }

  return (
    <Sheet
      open
      wide
      onClose={onClose}
      title={`Study plan · ${exam.name}`}
      footer={
        <>
          <button className="btn-soft" disabled={!plan.length} onClick={() => addTasks(false)}>Add as to-dos</button>
          <button className="btn-primary ml-auto" disabled={!plan.length} onClick={() => addTasks(true)}>Add & put on calendar ✨</button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <label>
            <span className="label">Topics (one per line)</span>
            <textarea className="input min-h-48" value={topics} onChange={(e) => setTopics(e.target.value)} placeholder={'Heart failure\nArrhythmias\nValvular disease\nHypertension\nIschemic heart disease'} />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label>
              <span className="label">Start</span>
              <input type="date" className="input !px-2" value={start} max={exam.date} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label>
              <span className="label">Learn (min)</span>
              <input type="number" min={15} step={15} className="input" value={mins} onChange={(e) => setMins(+e.target.value || 60)} />
            </label>
            <label>
              <span className="label">Review (min)</span>
              <input type="number" min={10} step={5} className="input" value={reviewMins} onChange={(e) => setReviewMins(+e.target.value || 30)} />
            </label>
          </div>
        </div>
        <div className="max-h-[50dvh] overflow-y-auto rounded-3xl bg-surface-2 p-3">
          {!byDay.length && <p className="py-10 text-center text-sm text-muted">Your plan preview appears here 🐾</p>}
          {byDay.map(([d, items]) => (
            <div key={d} className="mb-3">
              <div className="text-xs font-extrabold uppercase text-muted">
                {format(parseISO(d), 'EEE MMM d')} · {items.reduce((a, i) => a + len(i.kind), 0)} min
              </div>
              {items.map((p, i) => (
                <div key={i} className="text-sm font-bold">{label(p)}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  )
}
