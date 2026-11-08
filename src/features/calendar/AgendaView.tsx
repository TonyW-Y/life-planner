import { addDays, eachDayOfInterval, format, isToday, isTomorrow } from 'date-fns'
import type { Task } from '../../data/types'
import { catColor, catMeta } from '../../lib/categories'
import { fmtD, type Occurrence } from '../../lib/recurrence'

export function AgendaView({ from, occurrences, tasks, onEdit, onOpenTask, days = 30 }: { from: Date; occurrences: Occurrence[]; tasks: Task[]; onEdit: (o: Occurrence) => void; onOpenTask: (id: string) => void; days?: number }) {
  const list = eachDayOfInterval({ start: from, end: addDays(from, days - 1) })
  let shown = 0
  return (
    <div className="flex flex-col gap-3">
      {list.map((d) => {
        const k = fmtD(d)
        const evs = occurrences.filter((o) => fmtD(o.start) <= k && fmtD(o.end) >= k)
        const ts = tasks.filter((t) => t.due === k && !t.done)
        if (!evs.length && !ts.length) return null
        shown++
        return (
          <section key={k}>
            <h3 className="mb-1 px-1 text-sm font-extrabold uppercase tracking-wide text-muted">
              {isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEEE')} · {format(d, 'MMM d')}
            </h3>
            <div className="card flex flex-col gap-1 !p-2">
              {evs.map((o) => (
                <button key={o.event.id + o.key} onClick={() => onEdit(o)} className="flex items-center gap-3 rounded-2xl p-2 text-left hover:bg-surface-2">
                  <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: catColor(o.event.category) }} />
                  <span className="w-20 shrink-0 text-sm font-bold text-muted">{o.event.allDay ? 'All day' : format(o.start, 'h:mm a')}</span>
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {o.event.emoji || catMeta(o.event.category).emoji} {o.event.title}
                  </span>
                  {o.recurring && <span className="text-xs">🔁</span>}
                </button>
              ))}
              {ts.map((t) => (
                <button key={t.id} onClick={() => onOpenTask(t.id)} className="flex items-center gap-3 rounded-2xl p-2 text-left hover:bg-surface-2">
                  <span className="h-10 w-1.5 shrink-0 rounded-full bg-line" />
                  <span className="w-20 shrink-0 text-sm font-bold text-muted">To-do</span>
                  <span className="min-w-0 flex-1 truncate font-bold">✅ {t.title}</span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
      {shown === 0 && (
        <div className="card py-10 text-center">
          <div className="text-5xl">☁️</div>
          <div className="h2 mt-2">Nothing planned yet</div>
          <div className="text-muted">A blank month — enjoy it, or add something above!</div>
        </div>
      )}
    </div>
  )
}
