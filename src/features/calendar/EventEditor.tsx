import { addDays, format, parseISO } from 'date-fns'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CalEvent, Category, Repeat } from '../../data/types'
import { copyOccurrenceToDates, createEvent, deleteOccurrence, duplicateOccurrence, updateOccurrence, type EditScope } from '../../data/actions'
import { CATEGORIES } from '../../lib/categories'
import { fmtD, type Occurrence } from '../../lib/recurrence'
import { useDraft } from '../../lib/useDraft'
import { toast } from '../../lib/toast'
import { ChoiceSheet, Sheet } from '../../ui/Sheet'
import { RepeatPicker } from '../../ui/RepeatPicker'
import { MultiDatePicker } from '../../ui/MultiDatePicker'

export type EditorState = { mode: 'new'; initial: Partial<CalEvent> & { start: string; end: string } } | { mode: 'edit'; occ: Occurrence } | null

interface Form {
  title: string
  emoji: string
  category: Category
  allDay: boolean
  date: string
  endDate: string
  startTime: string
  endTime: string
  repeat: Repeat | null
  reminderMins: number | null
  notes: string
}

const REMINDERS: { v: number | null; label: string }[] = [
  { v: null, label: 'None' },
  { v: 0, label: 'At start' },
  { v: 5, label: '5 min' },
  { v: 15, label: '15 min' },
  { v: 30, label: '30 min' },
  { v: 60, label: '1 hour' },
  { v: 1440, label: '1 day' },
]

export const SCOPE_OPTIONS: { id: EditScope; label: string; hint: string }[] = [
  { id: 'one', label: 'Just this one', hint: 'Only this day changes' },
  { id: 'following', label: 'This and following', hint: 'This day and everything after it' },
  { id: 'all', label: 'All of them', hint: 'Every time it repeats' },
]

function toForm(s: EditorState): Form {
  const src = s?.mode === 'edit' ? { ...s.occ.event, start: format(s.occ.start, "yyyy-MM-dd'T'HH:mm"), end: format(s.occ.end, "yyyy-MM-dd'T'HH:mm") } : s?.initial
  const start = parseISO(src!.start)
  const end = parseISO(src!.end)
  return {
    title: src?.title ?? '',
    emoji: src?.emoji ?? '',
    category: src?.category ?? 'other',
    allDay: !!src?.allDay,
    date: fmtD(start),
    endDate: fmtD(end),
    startTime: format(start, 'HH:mm'),
    endTime: format(end, 'HH:mm'),
    repeat: src?.repeat ?? null,
    reminderMins: src?.reminderMins === undefined ? 15 : src.reminderMins,
    notes: src?.notes ?? '',
  }
}

function fromForm(f: Form): Partial<CalEvent> {
  let start = `${f.date}T${f.allDay ? '00:00' : f.startTime}`
  let end: string
  if (f.allDay) end = `${f.endDate < f.date ? f.date : f.endDate}T23:59`
  else {
    end = `${f.date}T${f.endTime}`
    if (f.endTime <= f.startTime) end = `${fmtD(addDays(parseISO(f.date), 1))}T${f.endTime}`
  }
  if (!f.allDay && f.startTime === f.endTime) end = format(new Date(parseISO(start).getTime() + 3600000), "yyyy-MM-dd'T'HH:mm")
  start = start.slice(0, 16)
  return {
    title: f.title.trim() || 'Untitled',
    emoji: f.emoji || undefined,
    category: f.category,
    allDay: f.allDay,
    start,
    end,
    repeat: f.repeat,
    reminderMins: f.allDay ? (f.reminderMins === null ? null : Math.max(f.reminderMins, 0)) : f.reminderMins,
    notes: f.notes,
  }
}

export function EventEditor({ state, onClose }: { state: EditorState; onClose: () => void }) {
  if (!state) return null
  const key = state.mode === 'new' ? `event:new:${state.initial.start}` : `event:${state.occ.event.id}:${state.occ.key}`
  return <EditorInner key={key} draftKey={key} state={state} onClose={onClose} />
}

function EditorInner({ state, onClose, draftKey }: { state: Exclude<EditorState, null>; onClose: () => void; draftKey: string }) {
  const initial = toForm(state)
  const { value: f, setValue, discard } = useDraft<Form>(draftKey, initial)
  const [askScope, setAskScope] = useState<null | 'save' | 'delete'>(null)
  const [copyOpen, setCopyOpen] = useState(false)
  const [copyDates, setCopyDates] = useState<string[]>([])
  const nav = useNavigate()
  const set = (p: Partial<Form>) => setValue((prev) => ({ ...prev, ...p }))
  const changed = JSON.stringify(f) !== JSON.stringify(initial)
  const occ = state.mode === 'edit' ? state.occ : null

  const commit = async (scope: EditScope = 'all') => {
    const patch = fromForm(f)
    if (state.mode === 'new') {
      await createEvent({ ...state.initial, ...patch } as CalEvent)
      toast(`Added “${patch.title}”`, { emoji: f.emoji || '📅' })
    } else if (changed) {
      // only send fields that changed so per-field merging stays precise
      const before = fromForm(initial) as Record<string, unknown>
      const diff = Object.fromEntries(Object.entries(patch).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k]))) as Partial<CalEvent>
      if (diff.start || diff.end) Object.assign(diff, { start: patch.start, end: patch.end })
      if (scope === 'one') delete diff.repeat
      await updateOccurrence(state.occ, diff, scope)
      toast('Saved 🐾', { emoji: '✓' })
    }
    await discard()
    onClose()
  }

  const close = async () => {
    if (state.mode === 'new') {
      if (f.title.trim()) await commit()
      else {
        await discard()
        onClose()
      }
      return
    }
    if (!changed) {
      await discard()
      return onClose()
    }
    if (occ?.recurring) setAskScope('save')
    else await commit()
  }

  return (
    <>
      <Sheet
        open
        onClose={close}
        title={state.mode === 'new' ? 'New event' : 'Event'}
        footer={
          <>
            {occ && (
              <>
                <button className="btn-soft" onClick={async () => { await duplicateOccurrence(occ); onClose() }}>📋 Duplicate</button>
                <button className="btn-soft" onClick={() => setCopyOpen(true)}>🗓️ Copy to…</button>
                <button className="btn-ghost" onClick={() => (occ.recurring ? setAskScope('delete') : deleteOccurrence(occ, 'all').then(onClose))}>🗑️</button>
              </>
            )}
            <button className="btn-primary ml-auto" onClick={close}>{state.mode === 'new' ? 'Add' : 'Done'}</button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <input className="input !w-16 text-center text-xl" maxLength={4} value={f.emoji} placeholder="🙂" onChange={(e) => set({ emoji: e.target.value })} aria-label="Emoji" />
            <input className="input text-lg font-bold" autoFocus={state.mode === 'new'} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="What's happening?" />
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={`chip ${f.category === c.id ? 'chip-on' : ''}`}
                style={f.category === c.id ? { borderColor: `var(--cat-${c.id})`, background: `color-mix(in srgb, var(--cat-${c.id}) 35%, transparent)` } : undefined}
                onClick={() => set({ category: c.id })}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-3">
            <label className="flex items-center justify-between font-bold">
              All day
              <input type="checkbox" className="h-6 w-6 accent-[var(--primary)]" checked={f.allDay} onChange={(e) => set({ allDay: e.target.checked })} />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <label className="col-span-2 sm:col-span-1">
                <span className="label">{f.allDay ? 'From' : 'Day'}</span>
                <input type="date" className="input" value={f.date} onChange={(e) => e.target.value && set({ date: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate })} />
              </label>
              {f.allDay ? (
                <label>
                  <span className="label">To</span>
                  <input type="date" className="input" value={f.endDate} min={f.date} onChange={(e) => set({ endDate: e.target.value })} />
                </label>
              ) : (
                <>
                  <label>
                    <span className="label">Start</span>
                    <input
                      type="time"
                      className="input"
                      value={f.startTime}
                      onChange={(e) => {
                        // keep the same length when moving the start
                        const [sh, sm] = f.startTime.split(':').map(Number)
                        const [eh, em] = f.endTime.split(':').map(Number)
                        const len = (eh * 60 + em - (sh * 60 + sm) + 1440) % 1440 || 60
                        const [nh, nm] = e.target.value.split(':').map(Number)
                        const t = (nh * 60 + nm + len) % 1440
                        set({ startTime: e.target.value, endTime: `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` })
                      }}
                    />
                  </label>
                  <label>
                    <span className="label">End</span>
                    <input type="time" className="input" value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} />
                  </label>
                </>
              )}
            </div>
          </div>

          <div>
            <div className="label">Repeat / clone</div>
            <RepeatPicker value={f.repeat} start={parseISO(`${f.date}T${f.startTime}`)} onChange={(r) => set({ repeat: r })} />
          </div>

          <div>
            <div className="label">Remind me</div>
            <div className="flex flex-wrap gap-2">
              {REMINDERS.map((r) => (
                <button key={String(r.v)} className={`chip ${f.reminderMins === r.v ? 'chip-on' : ''}`} onClick={() => set({ reminderMins: r.v })}>
                  {r.v === null ? '🔕' : '🔔'} {r.label}
                </button>
              ))}
            </div>
          </div>

          <label>
            <span className="label">Notes</span>
            <textarea className="input min-h-20" value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Room, what to bring, links…" />
          </label>

          {occ && (f.category === 'study' || f.category === 'exam') && (
            <button className="btn-soft" onClick={() => nav(`/study/timer?subject=${encodeURIComponent(f.title)}`)}>
              ⏱️ Start a focus session for this
            </button>
          )}
          <p className="text-center text-xs font-semibold text-muted">✓ Your typing is saved as you go — closing keeps your changes</p>
        </div>
      </Sheet>

      <ChoiceSheet
        open={askScope !== null}
        title={askScope === 'delete' ? 'Delete which ones?' : 'This repeats — change which ones?'}
        options={SCOPE_OPTIONS}
        onClose={() => setAskScope(null)}
        onPick={async (scope) => {
          const action = askScope
          setAskScope(null)
          if (action === 'delete' && occ) {
            await deleteOccurrence(occ, scope)
            await discard()
            onClose()
          } else await commit(scope)
        }}
      />

      <Sheet
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        title="Copy to which days?"
        footer={
          <button
            className="btn-primary w-full"
            disabled={!copyDates.length}
            onClick={async () => {
              if (occ) await copyOccurrenceToDates(occ, copyDates)
              setCopyOpen(false)
              setCopyDates([])
            }}
          >
            Copy to {copyDates.length || ''} day{copyDates.length === 1 ? '' : 's'}
          </button>
        }
      >
        <p className="mb-3 text-sm text-muted">Tap as many days as you like. For a regular pattern, use “Repeat / clone” instead.</p>
        <MultiDatePicker value={copyDates} onChange={setCopyDates} from={occ?.start} />
      </Sheet>
    </>
  )
}
