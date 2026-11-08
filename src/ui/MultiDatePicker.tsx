import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { useState } from 'react'
import { fmtD, monIndex } from '../lib/recurrence'

/** Tap any number of dates on a mini calendar. Includes quick fills. */
export function MultiDatePicker({ value, onChange, from = new Date() }: { value: string[]; onChange: (v: string[]) => void; from?: Date }) {
  const [month, setMonth] = useState(startOfMonth(from))
  const sel = new Set(value)
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) })
  const toggle = (d: string) => {
    const n = new Set(sel)
    if (n.has(d)) n.delete(d)
    else n.add(d)
    onChange([...n].sort())
  }
  const fill = (pred: (d: Date) => boolean, count = 7) => {
    const n = new Set(sel)
    for (let i = 1; i <= count; i++) {
      const d = addDays(from, i)
      if (pred(d)) n.add(fmtD(d))
    }
    onChange([...n].sort())
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
        <div className="font-extrabold">{format(month, 'MMMM yyyy')}</div>
        <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
        {days.map((d) => {
          const k = fmtD(d)
          const on = sel.has(k)
          return (
            <button
              type="button"
              key={k}
              onClick={() => toggle(k)}
              className={`aspect-square rounded-full text-sm font-bold transition ${on ? 'bg-primary text-primary-ink' : isSameMonth(d, month) ? 'text-ink hover:bg-surface-2' : 'text-muted/50'} ${k === fmtD(from) ? 'ring-2 ring-accent' : ''}`}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="chip" onClick={() => fill(() => true)}>Next 7 days</button>
        <button type="button" className="chip" onClick={() => fill((d) => monIndex(d) < 5, 14)}>Weekdays (2 wks)</button>
        <button type="button" className="chip" onClick={() => fill((d) => monIndex(d) === monIndex(from), 56)}>Same weekday (8 wks)</button>
        {value.length > 0 && (
          <button type="button" className="chip" onClick={() => onChange([])}>Clear ({value.length})</button>
        )}
      </div>
    </div>
  )
}
