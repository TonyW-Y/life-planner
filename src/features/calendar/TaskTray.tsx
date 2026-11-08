import type { PointerEvent as RPE } from 'react'
import type { Task } from '../../data/types'
import { PRIORITIES } from '../../lib/categories'

/** Unscheduled to-dos you can drag (or tap, then tap a time) onto the calendar. */
export function TaskTray({ tasks, placing, setPlacing, onDragStart, onAutoFill }: { tasks: Task[]; placing: Task | null; setPlacing: (t: Task | null) => void; onDragStart: (e: RPE, t: Task) => void; onAutoFill: () => void }) {
  return (
    <div className="card flex flex-col gap-2 !p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold">🧺 To-dos to place</h3>
        <button className="chip shrink-0 whitespace-nowrap" onClick={onAutoFill} disabled={!tasks.length} title="Put your to-dos into free time automatically">
          ✨ Auto-fill
        </button>
      </div>
      <p className="text-xs font-semibold text-muted">Drag onto a time, or tap one then tap the calendar.</p>
      <div className="flex max-h-[50dvh] flex-col gap-1.5 overflow-y-auto">
        {tasks.map((t) => {
          const pr = PRIORITIES.find((p) => p.id === t.priority)!
          return (
            <button
              key={t.id}
              onPointerDown={(e) => onDragStart(e, t)}
              onClick={() => setPlacing(placing?.id === t.id ? null : t)}
              style={{ touchAction: 'pan-y' }}
              className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 text-left text-sm font-bold transition ${placing?.id === t.id ? 'border-primary bg-primary-soft' : 'border-line bg-surface-2'}`}
            >
              <span>{pr.emoji}</span>
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              <span className="text-xs text-muted">{t.estimateMins ?? 60}m</span>
            </button>
          )
        })}
        {!tasks.length && <div className="py-4 text-center text-sm text-muted">All your to-dos have a time 🐾</div>}
      </div>
    </div>
  )
}
