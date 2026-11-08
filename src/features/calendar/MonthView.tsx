import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns'
import type { Task } from '../../data/types'
import { catColor } from '../../lib/categories'
import { fmtD, type Occurrence } from '../../lib/recurrence'

export function MonthView({ month, occurrences, tasks, onPickDay }: { month: Date; occurrences: Occurrence[]; tasks: Task[]; onPickDay: (d: Date) => void }) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) })
  return (
    <div className="card !p-2">
      <div className="grid grid-cols-7 text-center text-xs font-extrabold uppercase text-muted">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const k = fmtD(d)
          const evs = occurrences.filter((o) => fmtD(o.start) <= k && fmtD(o.end) >= k)
          const due = tasks.filter((t) => t.due === k && !t.done).length
          return (
            <button
              key={k}
              onClick={() => onPickDay(d)}
              className={`flex min-h-20 flex-col gap-0.5 rounded-2xl p-1 text-left transition hover:bg-surface-2 md:min-h-28 ${isSameMonth(d, month) ? '' : 'opacity-40'}`}
            >
              <span className={`flex h-7 w-7 items-center justify-center self-center rounded-full text-sm font-extrabold md:self-start ${isToday(d) ? 'bg-primary text-primary-ink' : ''}`}>{d.getDate()}</span>
              {/* dots on phones, chips on desktop */}
              <div className="flex flex-wrap justify-center gap-0.5 md:hidden">
                {evs.slice(0, 4).map((o) => (
                  <span key={o.event.id + o.key} className="h-2 w-2 rounded-full" style={{ background: catColor(o.event.category) }} />
                ))}
              </div>
              <div className="hidden flex-col gap-0.5 md:flex">
                {evs.slice(0, 3).map((o) => (
                  <span key={o.event.id + o.key} className="truncate rounded-md px-1 text-[11px] font-bold" style={{ background: catColor(o.event.category) }}>
                    {o.event.allDay ? '' : format(o.start, 'h:mma').toLowerCase() + ' '}
                    {o.event.title}
                  </span>
                ))}
                {evs.length > 3 && <span className="px-1 text-[11px] font-bold text-muted">+{evs.length - 3} more</span>}
              </div>
              {due > 0 && <span className="mt-auto self-center text-[10px] font-bold text-muted md:self-start">✅ {due}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
