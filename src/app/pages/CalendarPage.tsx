import { useLiveQuery } from 'dexie-react-hooks'
import {
  addDays,
  addMinutes,
  addMonths,
  addWeeks,
  differenceInCalendarWeeks,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPE } from 'react'
import { useSearchParams } from 'react-router-dom'
import { db, remove } from '../../data/db'
import type { CalEvent, Task, Template } from '../../data/types'
import { applyTemplate, copyDay, copyWeek, createEvent, saveTemplate, updateOccurrence, type EditScope } from '../../data/actions'
import { EventEditor, SCOPE_OPTIONS, type EditorState } from '../../features/calendar/EventEditor'
import { TimeGrid } from '../../features/calendar/TimeGrid'
import { MonthView } from '../../features/calendar/MonthView'
import { AgendaView } from '../../features/calendar/AgendaView'
import { TaskTray } from '../../features/calendar/TaskTray'
import { TaskEditor } from '../../features/tasks/TaskEditor'
import { QuickAdd } from '../../features/quickadd/QuickAdd'
import { expandEvents, fmtD, fmtDT, type Occurrence } from '../../lib/recurrence'
import { guessCategory } from '../../lib/quickAdd'
import { autoFill, type Awake } from '../../lib/slots'
import { toast } from '../../lib/toast'
import { useSetting } from '../../lib/useSetting'
import { Segmented } from '../../ui/Segmented'
import { ChoiceSheet, Sheet } from '../../ui/Sheet'
import { MultiDatePicker } from '../../ui/MultiDatePicker'

type View = 'day' | 'week' | 'month' | 'agenda'
export const DEFAULT_AWAKE: Awake = { wake: '08:00', bed: '23:00' }
const PRI = { must: 0, should: 1, nice: 2 }

export function useOccurrences(from: Date, to: Date) {
  const events = useLiveQuery(() => db.events.filter((e) => !e.deleted).toArray(), [], [] as CalEvent[])
  return useMemo(() => expandEvents(events, from, to), [events, from.getTime(), to.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps
}

export function CalendarPage() {
  const [params, setParams] = useSearchParams()
  const [savedView, setSavedView] = useSetting<View>('calView', typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week')
  const view = (params.get('v') as View) || savedView
  const cursor = params.get('d') ? parseISO(params.get('d')!) : startOfDay(new Date())
  const setView = (v: View) => {
    void setSavedView(v)
    setParams((p) => {
      p.set('v', v)
      return p
    })
  }
  const setCursor = (d: Date) =>
    setParams((p) => {
      p.set('d', fmtD(d))
      return p
    })

  const [awake] = useSetting<Awake>('awake', DEFAULT_AWAKE)
  const [copyMode, setCopyMode] = useState(false)
  const [editor, setEditor] = useState<EditorState>(null)
  const [taskOpen, setTaskOpen] = useState<string | null>(null)
  const [placing, setPlacing] = useState<Task | null>(null)
  const [pendingMove, setPendingMove] = useState<{ occ: Occurrence; start: Date; end: Date } | null>(null)
  const [sheet, setSheet] = useState<null | 'copy' | 'templates' | 'more'>(null)
  const [copyDates, setCopyDates] = useState<string[]>([])
  const [tplName, setTplName] = useState('')
  const taskDrag = useRef<((e: RPE, t: Task) => void) | null>(null)

  const range = useMemo(() => {
    if (view === 'day') return { from: cursor, to: addDays(cursor, 1) }
    if (view === 'week') {
      const s = startOfWeek(cursor, { weekStartsOn: 1 })
      return { from: s, to: addDays(s, 7) }
    }
    if (view === 'month') return { from: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), to: addDays(endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }), 1) }
    return { from: startOfDay(new Date()), to: addDays(startOfDay(new Date()), 30) }
  }, [view, cursor.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  const occurrences = useOccurrences(range.from, range.to)
  const tasks = useLiveQuery(() => db.tasks.filter((t) => !t.deleted).toArray(), [], [] as Task[])
  const linked = useLiveQuery(async () => new Set((await db.events.filter((e) => !e.deleted && !!e.taskId).toArray()).map((e) => e.taskId!)), [], new Set<string>())
  const templates = useLiveQuery(() => db.templates.filter((t) => !t.deleted).toArray(), [], [] as Template[])
  const tray = tasks.filter((t) => !t.done && !linked.has(t.id)).sort((a, b) => PRI[a.priority] - PRI[b.priority] || (a.due ?? '9').localeCompare(b.due ?? '9'))

  const days = view === 'day' ? [cursor] : Array.from({ length: 7 }, (_, i) => addDays(range.from, i))

  const step = (dir: number) => {
    if (view === 'day') setCursor(addDays(cursor, dir))
    else if (view === 'week') setCursor(addWeeks(cursor, dir))
    else if (view === 'month') setCursor(addMonths(cursor, dir))
  }

  // keyboard: ← → to move, T for today, N for new
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select,[role=dialog]')) return
      if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key.toLowerCase() === 't') setCursor(startOfDay(new Date()))
      else if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        openNew(new Date(Math.ceil(Date.now() / 1800000) * 1800000))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const openNew = (start: Date, end = addMinutes(start, 60), allDay = false) =>
    setEditor({ mode: 'new', initial: { start: fmtDT(start), end: fmtDT(end), allDay, category: 'other' } })

  const placeTask = useCallback(async (t: Task, start: Date) => {
    await createEvent({
      title: t.title,
      emoji: t.emoji,
      start: fmtDT(start),
      end: fmtDT(addMinutes(start, t.estimateMins ?? 60)),
      category: guessCategory(t.title + ' ' + t.tags.join(' ')) === 'other' ? 'study' : guessCategory(t.title + ' ' + t.tags.join(' ')),
      taskId: t.id,
      reminderMins: 5,
    })
    setPlacing(null)
    toast(`Placed “${t.title}” at ${format(start, 'h:mm a')}`, { emoji: '🧩' })
  }, [])

  const doMove = async (occ: Occurrence, start: Date, end: Date, scope: EditScope) => {
    await updateOccurrence(occ, { start: fmtDT(start), end: fmtDT(end) }, scope)
    toast(`Moved to ${format(start, 'EEE h:mm a')}`, { emoji: '🧩' })
  }

  const onMove = async (occ: Occurrence, start: Date, end: Date, copy: boolean) => {
    if (copy) {
      const { id: _i, _fts, updatedAt, exdates, overrideOf, ...rest } = occ.event
      void _i; void _fts; void updatedAt; void exdates; void overrideOf
      await createEvent({ ...rest, start: fmtDT(start), end: fmtDT(end), repeat: null })
      toast('Copied 📋', { emoji: '🐾' })
    } else if (occ.recurring) setPendingMove({ occ, start, end })
    else await doMove(occ, start, end, 'all')
  }

  const runAutoFill = async () => {
    const today = startOfDay(new Date())
    const fillDays = days.filter((d) => d >= today)
    if (!fillDays.length) return toast('Pick today or a future day to auto-fill', { emoji: '🗓️' })
    const busy = occurrences.filter((o) => !o.event.allDay).map((o) => ({ start: o.start, end: o.end }))
    const { placed, unplaced } = autoFill(
      tray.map((t) => ({ id: t.id, mins: t.estimateMins ?? 60, t })),
      fillDays,
      awake,
      busy,
      { now: new Date() },
    )
    for (const p of placed) await placeTaskSilent(p.item.t, p.start)
    toast(placed.length ? `Placed ${placed.length} to-do${placed.length === 1 ? '' : 's'} in your free time ✨${unplaced.length ? ` (${unplaced.length} didn't fit)` : ''}` : "No free space left — that's a full day!", { emoji: '🧩' })
  }
  const placeTaskSilent = async (t: Task, start: Date) =>
    createEvent({
      title: t.title,
      emoji: t.emoji,
      start: fmtDT(start),
      end: fmtDT(addMinutes(start, t.estimateMins ?? 60)),
      category: guessCategory(t.title) === 'other' ? 'study' : guessCategory(t.title),
      taskId: t.id,
      reminderMins: 5,
    })

  const title =
    view === 'day'
      ? format(cursor, 'EEEE, MMM d')
      : view === 'week'
        ? `${format(range.from, 'MMM d')} – ${format(addDays(range.from, 6), 'MMM d')}`
        : view === 'month'
          ? format(cursor, 'MMMM yyyy')
          : 'Next 30 days'
  const unitLabel = view === 'day' ? 'day' : 'week'
  const unitStart = view === 'day' ? cursor : range.from

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">Calendar 📅</h1>
        <Segmented
          value={view}
          onChange={setView}
          size="sm"
          options={[
            { id: 'day', label: 'Day' },
            { id: 'week', label: 'Week' },
            { id: 'month', label: 'Month' },
            { id: 'agenda', label: 'Agenda' },
          ]}
        />
      </div>

      <QuickAdd placeholder="Add… e.g. “Lecture Mon Wed Fri 9am every week until Dec 18”" defaultDate={view === 'day' ? cursor : undefined} />

      <div className="flex flex-wrap items-center gap-2">
        {view !== 'agenda' && (
          <>
            <button className="icon-btn" aria-label="Previous" onClick={() => step(-1)}>‹</button>
            <button className="chip" onClick={() => setCursor(startOfDay(new Date()))}>Today</button>
            <button className="icon-btn" aria-label="Next" onClick={() => step(1)}>›</button>
          </>
        )}
        <h2 className="h2 mr-auto">{title}</h2>
        {(view === 'day' || view === 'week') && (
          <button className={`chip ${copyMode ? 'chip-on' : ''}`} onClick={() => setCopyMode(!copyMode)} title="When on, dragging an event makes a copy (or hold Alt)">
            📋 Drag copies
          </button>
        )}
        <button className="chip" onClick={() => setSheet('more')}>⋯ More</button>
        <button className="btn-primary !min-h-10" onClick={() => openNew(new Date(Math.max(cursor.getTime(), Math.ceil(Date.now() / 1800000) * 1800000)))}>
          + Event
        </button>
      </div>

      {placing && (
        <div className="card flex items-center justify-between !bg-primary-soft !py-2">
          <span className="font-bold">👆 Tap a time to place “{placing.title}”</span>
          <button className="chip" onClick={() => setPlacing(null)}>Cancel</button>
        </div>
      )}

      {(view === 'day' || view === 'week') && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <TimeGrid
            days={days}
            occurrences={occurrences}
            onEdit={(occ) => setEditor({ mode: 'edit', occ })}
            onCreate={(s, e) => openNew(s, e)}
            onMove={onMove}
            onPlaceTask={placeTask}
            placing={placing}
            copyMode={copyMode}
            scrollToHour={parseInt(awake.wake)}
            registerTaskDrag={(fn) => (taskDrag.current = fn)}
          />
          <TaskTray tasks={tray} placing={placing} setPlacing={setPlacing} onDragStart={(e, t) => taskDrag.current?.(e, t)} onAutoFill={runAutoFill} />
        </div>
      )}
      {view === 'month' && (
        <MonthView
          month={cursor}
          occurrences={occurrences}
          tasks={tasks}
          onPickDay={(d) => {
            setParams((p) => {
              p.set('d', fmtD(d))
              p.set('v', 'day')
              return p
            })
          }}
        />
      )}
      {view === 'agenda' && <AgendaView from={startOfDay(new Date())} occurrences={occurrences} tasks={tasks} onEdit={(occ) => setEditor({ mode: 'edit', occ })} onOpenTask={setTaskOpen} />}

      <EventEditor state={editor} onClose={() => setEditor(null)} />
      <TaskEditor taskId={taskOpen} onClose={() => setTaskOpen(null)} />

      <ChoiceSheet
        open={!!pendingMove}
        title="This repeats — move which ones?"
        options={SCOPE_OPTIONS}
        onClose={() => setPendingMove(null)}
        onPick={async (scope) => {
          const m = pendingMove!
          setPendingMove(null)
          await doMove(m.occ, m.start, m.end, scope)
        }}
      />

      {/* More menu */}
      <Sheet open={sheet === 'more'} onClose={() => setSheet(null)} title="More">
        <div className="flex flex-col gap-2 pb-2">
          {view !== 'month' && view !== 'agenda' && (
            <>
              <button className="btn-soft justify-start" onClick={() => setSheet('copy')}>📋 Copy this {unitLabel} to…</button>
              <button className="btn-soft justify-start" onClick={() => setSheet('templates')}>🧺 Templates (save or use a {unitLabel} layout)</button>
            </>
          )}
          <button className="btn-soft justify-start" onClick={() => { setView('day'); setSheet(null) }}>🔎 Day view</button>
          <p className="px-2 text-sm text-muted">Keyboard: ← → move · T today · N new event · Alt-drag copies</p>
        </div>
      </Sheet>

      {/* Copy day / week */}
      <Sheet
        open={sheet === 'copy'}
        onClose={() => setSheet(null)}
        title={`Copy this ${unitLabel} (${occurrences.filter((o) => view === 'week' || fmtD(o.start) === fmtD(cursor)).length} things)`}
        footer={
          view === 'day' ? (
            <button
              className="btn-primary w-full"
              disabled={!copyDates.length}
              onClick={async () => {
                await copyDay(cursor, copyDates)
                setCopyDates([])
                setSheet(null)
              }}
            >
              Copy to {copyDates.length || ''} day{copyDates.length === 1 ? '' : 's'}
            </button>
          ) : undefined
        }
      >
        {view === 'day' ? (
          <MultiDatePicker value={copyDates} onChange={setCopyDates} from={cursor} />
        ) : (
          <WeekCopier
            from={range.from}
            onCopy={async (weeks) => {
              await copyWeek(range.from, weeks)
              setSheet(null)
            }}
          />
        )}
      </Sheet>

      {/* Templates */}
      <Sheet open={sheet === 'templates'} onClose={() => setSheet(null)} title="Templates 🧺">
        <div className="flex flex-col gap-4 pb-2">
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!tplName.trim()) return
              await saveTemplate(tplName.trim(), view === 'day' ? 'day' : 'week', unitStart)
              setTplName('')
            }}
          >
            <input className="input" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder={`Name this ${unitLabel}, e.g. “${view === 'day' ? 'Lecture day' : 'Rotation week'}”`} />
            <button className="btn-primary shrink-0">Save</button>
          </form>
          <div className="flex flex-col gap-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-2xl bg-surface-2 p-3">
                <div className="flex-1">
                  <div className="font-extrabold">{t.name}</div>
                  <div className="text-xs font-bold text-muted">
                    {t.kind === 'day' ? 'Day' : 'Week'} · {t.items.length} things
                  </div>
                </div>
                <button
                  className="btn-primary !min-h-9 !px-3 text-sm"
                  onClick={async () => {
                    await applyTemplate(t, t.kind === 'week' ? startOfWeek(cursor, { weekStartsOn: 1 }) : cursor)
                    setSheet(null)
                  }}
                >
                  Use on {t.kind === 'week' ? `week of ${format(startOfWeek(cursor, { weekStartsOn: 1 }), 'MMM d')}` : format(cursor, 'MMM d')}
                </button>
                <button className="icon-btn" aria-label="Delete template" onClick={() => remove('templates', t.id)}>🗑️</button>
              </div>
            ))}
            {!templates.length && <p className="text-center text-sm text-muted">No templates yet. Set up a typical day or week, then save it here.</p>}
          </div>
        </div>
      </Sheet>
    </div>
  )
}

function WeekCopier({ from, onCopy }: { from: Date; onCopy: (weeks: Date[]) => void }) {
  const [until, setUntil] = useState(fmtD(addWeeks(from, 4)))
  const weeksUntil = () => {
    const n = Math.max(1, differenceInCalendarWeeks(parseISO(until), from, { weekStartsOn: 1 }))
    return Array.from({ length: n }, (_, i) => addWeeks(from, i + 1))
  }
  return (
    <div className="flex flex-col gap-3 pb-2">
      <button className="btn-soft" onClick={() => onCopy([addWeeks(from, 1)])}>➡️ Next week</button>
      <button className="btn-soft" onClick={() => onCopy([1, 2, 3, 4].map((i) => addWeeks(from, i)))}>Next 4 weeks</button>
      <div className="rounded-2xl bg-surface-2 p-3">
        <div className="label">Every week until…</div>
        <div className="flex gap-2">
          <input type="date" className="input" value={until} min={fmtD(addWeeks(from, 1))} onChange={(e) => setUntil(e.target.value)} />
          <button className="btn-primary shrink-0" onClick={() => onCopy(weeksUntil())}>Copy ({weeksUntil().length})</button>
        </div>
      </div>
    </div>
  )
}

