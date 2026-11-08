import { motion, useAnimation } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { useRef } from 'react'
import type { Task } from '../../data/types'
import { snoozeTask, toggleTask } from '../../data/actions'
import { PRIORITIES } from '../../lib/categories'
import { fmtD } from '../../lib/recurrence'

export function TaskItem({ task, onOpen, draggable }: { task: Task; onOpen: () => void; draggable?: boolean }) {
  const ctrl = useAnimation()
  const ref = useRef<HTMLButtonElement>(null)
  const pr = PRIORITIES.find((p) => p.id === task.priority)!
  const today = fmtD(new Date())
  const overdue = !task.done && task.due && task.due < today
  const subDone = task.subtasks.filter((s) => s.done).length

  return (
    <div className="relative overflow-hidden rounded-3xl">
      {/* swipe backgrounds */}
      <div className="absolute inset-0 flex items-center justify-between rounded-3xl px-5 text-sm font-extrabold">
        <span className="text-accent">✓ Done</span>
        <span className="text-warn">Tomorrow 🌙</span>
      </div>
      <motion.div
        drag={draggable ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        animate={ctrl}
        onDragEnd={async (_, info) => {
          if (info.offset.x > 90) await toggleTask(task, ref.current)
          else if (info.offset.x < -90) await snoozeTask(task)
          void ctrl.start({ x: 0 })
        }}
        className={`relative flex items-center gap-3 rounded-3xl border border-line bg-surface p-3 shadow-soft ${task.done ? 'opacity-60' : ''}`}
      >
        <button
          ref={ref}
          aria-label={task.done ? 'Mark not done' : 'Mark done'}
          onClick={() => toggleTask(task, ref.current)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[3px] transition active:scale-90"
          style={{ borderColor: pr.color, background: task.done ? pr.color : 'transparent' }}
        >
          {task.done && <span className="text-sm text-white">✓</span>}
        </button>
        <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <div className={`truncate font-bold ${task.done ? 'line-through' : ''}`}>
            {task.emoji && <span className="mr-1">{task.emoji}</span>}
            {task.title}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs font-bold text-muted">
            {task.due && (
              <span className={overdue ? 'rounded-full bg-warn-soft px-2 text-ink' : ''}>
                {overdue ? 'still on the list 💛 ' : ''}
                {task.due === today ? 'Today' : format(parseISO(task.due), 'EEE MMM d')}
              </span>
            )}
            {task.reminderAt && <span>🔔 {format(parseISO(task.reminderAt), 'h:mm a')}</span>}
            {task.repeat && <span>🔁</span>}
            {task.estimateMins && <span>⏱ {task.estimateMins}m</span>}
            {task.subtasks.length > 0 && (
              <span>
                ☑ {subDone}/{task.subtasks.length}
              </span>
            )}
            {task.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </div>
        </button>
        <span title={pr.label} className="text-lg">
          {pr.emoji}
        </span>
      </motion.div>
    </div>
  )
}
