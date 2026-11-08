import { format } from 'date-fns'
import { useMemo } from 'react'
import { createEvent, createTask } from '../../data/actions'
import { parseQuickAdd } from '../../lib/quickAdd'
import { catMeta } from '../../lib/categories'
import { describeRepeat, fmtD, fmtDT } from '../../lib/recurrence'
import { useDraft } from '../../lib/useDraft'
import { toast } from '../../lib/toast'

/**
 * One cozy input that understands plain English:
 *   "Anki 8pm daily until Dec 20" · "Pharm exam Friday 9am" · "laundry tomorrow !nice #home"
 * mode 'auto' makes an event when a time is given, otherwise a to-do.
 */
export function QuickAdd({ mode = 'auto', placeholder, defaultDate }: { mode?: 'auto' | 'task' | 'event'; placeholder?: string; defaultDate?: Date }) {
  const { value, setValue, discard } = useDraft(`quickadd:${mode}`, '')
  const parsed = useMemo(() => (value.trim() ? parseQuickAdd(value) : null), [value])
  const asEvent = parsed && (mode === 'event' || (mode === 'auto' && parsed.hasTime))

  const submit = async () => {
    if (!parsed) return
    if (asEvent) {
      const base = parsed.start ?? defaultDate ?? new Date()
      const start = parsed.hasTime ? base : new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0)
      const end = parsed.end ?? (parsed.hasTime ? new Date(start.getTime() + 3600000) : new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59))
      await createEvent({
        title: parsed.title,
        start: fmtDT(start),
        end: fmtDT(end),
        allDay: !parsed.hasTime,
        category: parsed.category,
        repeat: parsed.repeat,
        reminderMins: parsed.hasTime ? 15 : null,
      })
      toast(`Added “${parsed.title}” to your calendar`, { emoji: catMeta(parsed.category).emoji })
    } else {
      const due = parsed.start ? fmtD(parsed.start) : defaultDate ? fmtD(defaultDate) : null
      await createTask({
        title: parsed.title,
        due: due ?? (parsed.repeat ? fmtD(new Date()) : null),
        priority: parsed.priority ?? 'should',
        tags: parsed.tags,
        repeat: parsed.repeat,
        reminderAt: parsed.hasTime && parsed.start ? fmtDT(parsed.start) : null,
        estimateMins: parsed.durationMins ?? undefined,
      })
      toast(`Added “${parsed.title}”`, { emoji: '✅' })
    }
    setValue('')
    await discard()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex gap-2">
        <input
          className="input !min-h-12 !rounded-full !px-5"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder ?? 'Add anything… e.g. “Anki 8pm daily until Dec 20”'}
          aria-label="Quick add"
        />
        <button className="btn-primary !min-h-12 shrink-0" disabled={!parsed}>
          Add
        </button>
      </div>
      {parsed && (
        <div className="flex flex-wrap gap-1.5 px-2 text-xs font-bold">
          <span className="rounded-full bg-primary-soft px-2 py-1">{asEvent ? '📅 Event' : '✅ To-do'}: {parsed.title}</span>
          {parsed.start && (
            <span className="rounded-full bg-surface-2 px-2 py-1">
              🗓️ {format(parsed.start, parsed.hasTime ? 'EEE MMM d, h:mm a' : 'EEE MMM d')}
            </span>
          )}
          {parsed.repeat && <span className="rounded-full bg-accent-soft px-2 py-1">🔁 {describeRepeat(parsed.repeat, parsed.start ?? undefined)}</span>}
          {parsed.priority && <span className="rounded-full bg-surface-2 px-2 py-1">⭐ {parsed.priority}</span>}
          {parsed.tags.map((t) => (
            <span key={t} className="rounded-full bg-surface-2 px-2 py-1">#{t}</span>
          ))}
          {asEvent && <span className="rounded-full bg-surface-2 px-2 py-1">{catMeta(parsed.category).emoji} {catMeta(parsed.category).label}</span>}
        </div>
      )}
    </form>
  )
}
