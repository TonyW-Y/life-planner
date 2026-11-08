import { useLiveQuery } from 'dexie-react-hooks'
import { addDays } from 'date-fns'
import { useMemo, useState } from 'react'
import { db } from '../../data/db'
import type { Task } from '../../data/types'
import { rollOver } from '../../data/actions'
import { QuickAdd } from '../../features/quickadd/QuickAdd'
import { TaskItem } from '../../features/tasks/TaskItem'
import { TaskEditor } from '../../features/tasks/TaskEditor'
import { fmtD } from '../../lib/recurrence'
import { useSetting } from '../../lib/useSetting'
import { Segmented } from '../../ui/Segmented'

const PRI_ORDER = { must: 0, should: 1, nice: 2 }
const sortTasks = (a: Task, b: Task) => PRI_ORDER[a.priority] - PRI_ORDER[b.priority] || (a.due ?? '9').localeCompare(b.due ?? '9') || a.order - b.order

export function TasksPage() {
  const tasks = useLiveQuery(() => db.tasks.filter((t) => !t.deleted).toArray(), [], [])
  const [view, setView] = useSetting<'list' | 'matrix'>('tasksView', 'list')
  const [openId, setOpenId] = useState<string | null>(null)
  const [tag, setTag] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)

  const today = fmtD(new Date())
  const weekEnd = fmtD(addDays(new Date(), 7))
  const allTags = useMemo(() => [...new Set(tasks.flatMap((t) => t.tags))].sort(), [tasks])
  const filtered = tasks.filter((t) => !tag || t.tags.includes(tag))
  const open = filtered.filter((t) => !t.done)
  const overdue = open.filter((t) => t.due && t.due < today).sort(sortTasks)
  const groups: { title: string; emoji: string; items: Task[] }[] = [
    { title: 'Today', emoji: '☀️', items: open.filter((t) => t.due === today).sort(sortTasks) },
    { title: 'This week', emoji: '🗓️', items: open.filter((t) => t.due && t.due > today && t.due <= weekEnd).sort(sortTasks) },
    { title: 'Later', emoji: '🌙', items: open.filter((t) => t.due && t.due > weekEnd).sort(sortTasks) },
    { title: 'Whenever', emoji: '☁️', items: open.filter((t) => !t.due).sort(sortTasks) },
  ]
  const done = filtered.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">To-do ✅</h1>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { id: 'list', label: 'List' },
            { id: 'matrix', label: 'Matrix' },
          ]}
        />
      </div>
      <QuickAdd mode="task" placeholder="Add a to-do… e.g. “Finish renal notes tomorrow !must #renal”" />
      <p className="-mt-2 px-2 text-xs font-semibold text-muted">Tip: swipe right to finish ✓, swipe left to move to tomorrow 🌙</p>

      {allTags.length > 0 && (
        <div className="scrollbar-none flex gap-2 overflow-x-auto">
          <button className={`chip shrink-0 ${!tag ? 'chip-on' : ''}`} onClick={() => setTag(null)}>All</button>
          {allTags.map((t) => (
            <button key={t} className={`chip shrink-0 ${tag === t ? 'chip-on' : ''}`} onClick={() => setTag(tag === t ? null : t)}>
              #{t}
            </button>
          ))}
        </div>
      )}

      {overdue.length > 0 && (
        <div className="card flex flex-wrap items-center gap-3 !bg-warn-soft">
          <span className="text-2xl">💛</span>
          <div className="flex-1">
            <div className="font-extrabold">{overdue.length} thing{overdue.length === 1 ? ' is' : 's are'} still on the list</div>
            <div className="text-sm text-muted">No stress — want to carry {overdue.length === 1 ? 'it' : 'them'} over to today?</div>
          </div>
          <button className="btn-primary" onClick={() => rollOver(overdue)}>Carry over</button>
        </div>
      )}

      {view === 'list' ? (
        <>
          {overdue.length > 0 && <Group title="From before" emoji="🍂" items={overdue} onOpen={setOpenId} />}
          {groups.map((g) => g.items.length > 0 && <Group key={g.title} {...g} onOpen={setOpenId} />)}
          {open.length === 0 && (
            <div className="card flex flex-col items-center gap-2 py-10 text-center">
              <div className="text-5xl">🧸</div>
              <div className="h2">All clear!</div>
              <div className="text-muted">Nothing on your list. Add something above, or go have a cozy break.</div>
            </div>
          )}
        </>
      ) : (
        <Matrix tasks={open} onOpen={setOpenId} />
      )}

      {done.length > 0 && (
        <div>
          <button className="btn-ghost" onClick={() => setShowDone(!showDone)}>
            {showDone ? '▾' : '▸'} Done ({done.length}) 🎉
          </button>
          {showDone && (
            <div className="mt-2 flex flex-col gap-2">
              {done.slice(0, 50).map((t) => (
                <TaskItem key={t.id} task={t} onOpen={() => setOpenId(t.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      <TaskEditor taskId={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}

function Group({ title, emoji, items, onOpen }: { title: string; emoji: string; items: Task[]; onOpen: (id: string) => void }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-extrabold uppercase tracking-wide text-muted">
        {emoji} {title} · {items.length}
      </h2>
      <div className="flex flex-col gap-2">
        {items.map((t) => (
          <TaskItem key={t.id} task={t} onOpen={() => onOpen(t.id)} />
        ))}
      </div>
    </section>
  )
}

function Matrix({ tasks, onOpen }: { tasks: Task[]; onOpen: (id: string) => void }) {
  const urgent = (t: Task) => t.urgent ?? (!!t.due && t.due <= fmtD(addDays(new Date(), 1)))
  const important = (t: Task) => t.important ?? t.priority === 'must'
  const q = [
    { title: 'Do now', hint: 'urgent + important', emoji: '🔥', items: tasks.filter((t) => urgent(t) && important(t)) },
    { title: 'Plan it', hint: 'important, not urgent', emoji: '🗓️', items: tasks.filter((t) => !urgent(t) && important(t)) },
    { title: 'Quick wins', hint: 'urgent, less important', emoji: '⚡', items: tasks.filter((t) => urgent(t) && !important(t)) },
    { title: 'Later / maybe', hint: 'neither', emoji: '☁️', items: tasks.filter((t) => !urgent(t) && !important(t)) },
  ]
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {q.map((x) => (
        <div key={x.title} className="card !bg-surface-2">
          <div className="mb-2">
            <span className="h2">
              {x.emoji} {x.title}
            </span>{' '}
            <span className="text-xs font-bold text-muted">{x.hint}</span>
          </div>
          <div className="flex flex-col gap-2">
            {x.items.map((t) => (
              <TaskItem key={t.id} task={t} onOpen={() => onOpen(t.id)} />
            ))}
            {!x.items.length && <div className="py-4 text-center text-sm text-muted">nothing here 🐾</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
