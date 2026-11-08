import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { parseISO } from 'date-fns'
import { db, save, uid } from '../../data/db'
import type { Task } from '../../data/types'
import { copyTaskToDates, deleteTask, duplicateTask } from '../../data/actions'
import { PRIORITIES } from '../../lib/categories'
import { Sheet } from '../../ui/Sheet'
import { RepeatPicker } from '../../ui/RepeatPicker'
import { MultiDatePicker } from '../../ui/MultiDatePicker'

const EMOJIS = ['📚', '🩺', '🧠', '💊', '🫀', '🦴', '🧪', '📝', '💌', '🛒', '🧺', '🏃‍♀️', '☕', '🌷', '🐾', '🎀']

/** Every field saves the moment it changes — there is no save button to forget. */
export function TaskEditor({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const task = useLiveQuery(() => (taskId ? db.tasks.get(taskId) : undefined), [taskId])
  const [copyOpen, setCopyOpen] = useState(false)
  const [copyDates, setCopyDates] = useState<string[]>([])
  const [newSub, setNewSub] = useState('')
  const [newTag, setNewTag] = useState('')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const typing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setNotes(task.notes ?? '')
    }
    // only on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id])

  if (!taskId) return null
  const set = (patch: Partial<Task>) => task && save<Task>('tasks', { id: task.id, ...patch })
  const setDebounced = (patch: Partial<Task>) => {
    clearTimeout(typing.current)
    typing.current = setTimeout(() => void set(patch), 200)
  }

  return (
    <>
      <Sheet
        open={!!taskId && !!task}
        onClose={() => {
          clearTimeout(typing.current)
          if (task && (title !== task.title || notes !== (task.notes ?? ''))) void set({ title: title || task.title, notes })
          onClose()
        }}
        title="Task"
        footer={
          task && (
            <>
              <button className="btn-soft" onClick={() => duplicateTask(task)}>📋 Duplicate</button>
              <button className="btn-soft" onClick={() => setCopyOpen(true)}>🗓️ Copy to days…</button>
              <button
                className="btn-ghost ml-auto"
                onClick={async () => {
                  await deleteTask(task)
                  onClose()
                }}
              >
                🗑️ Delete
              </button>
            </>
          )
        }
      >
        {task && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <select
                aria-label="Emoji"
                className="input !w-16 text-center text-xl"
                value={task.emoji ?? ''}
                onChange={(e) => set({ emoji: e.target.value || undefined })}
              >
                <option value="">·</option>
                {EMOJIS.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
              <input
                className="input text-lg font-bold"
                value={title}
                autoFocus={!task.title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setDebounced({ title: e.target.value })
                }}
                placeholder="What needs doing?"
              />
            </div>

            <div>
              <div className="label">Priority</div>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((p) => (
                  <button key={p.id} className={`chip ${task.priority === p.id ? 'chip-on' : ''}`} onClick={() => set({ priority: p.id })}>
                    {p.emoji} {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="label">Due</span>
                <input type="date" className="input" value={task.due ?? ''} onChange={(e) => set({ due: e.target.value || null })} />
              </label>
              <label>
                <span className="label">How long? (min)</span>
                <input
                  type="number"
                  min={5}
                  step={5}
                  className="input"
                  value={task.estimateMins ?? ''}
                  placeholder="30"
                  onChange={(e) => set({ estimateMins: e.target.value ? +e.target.value : undefined })}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className={`chip ${task.urgent ? 'chip-on' : ''}`} onClick={() => set({ urgent: !task.urgent })}>⏰ Urgent</button>
              <button className={`chip ${task.important ? 'chip-on' : ''}`} onClick={() => set({ important: !task.important })}>💎 Important</button>
              <label className="chip">
                🔔
                <input
                  type="datetime-local"
                  className="bg-transparent text-sm outline-none"
                  value={task.reminderAt ?? ''}
                  onChange={(e) => set({ reminderAt: e.target.value || null })}
                  aria-label="Reminder"
                />
              </label>
            </div>

            <div>
              <div className="label">Repeat</div>
              <RepeatPicker
                value={task.repeat}
                start={task.due ? parseISO(task.due) : new Date()}
                onChange={(r) => set({ repeat: r, due: task.due ?? (r ? new Date().toISOString().slice(0, 10) : task.due) })}
              />
            </div>

            <div>
              <div className="label">Steps</div>
              <div className="flex flex-col gap-1">
                {task.subtasks.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-1">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[var(--primary)]"
                      checked={s.done}
                      onChange={() => set({ subtasks: task.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })}
                    />
                    <span className={`flex-1 ${s.done ? 'text-muted line-through' : ''}`}>{s.title}</span>
                    <button className="px-2 text-muted" aria-label="Remove step" onClick={() => set({ subtasks: task.subtasks.filter((x) => x.id !== s.id) })}>
                      ×
                    </button>
                  </div>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!newSub.trim()) return
                    void set({ subtasks: [...task.subtasks, { id: uid(), title: newSub.trim(), done: false }] })
                    setNewSub('')
                  }}
                >
                  <input className="input" placeholder="+ Add a step" value={newSub} onChange={(e) => setNewSub(e.target.value)} />
                </form>
              </div>
            </div>

            <div>
              <div className="label">Tags</div>
              <div className="flex flex-wrap items-center gap-2">
                {task.tags.map((t) => (
                  <button key={t} className="chip" onClick={() => set({ tags: task.tags.filter((x) => x !== t) })}>
                    #{t} ×
                  </button>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    const t = newTag.trim().replace(/^#/, '').toLowerCase()
                    if (t && !task.tags.includes(t)) void set({ tags: [...task.tags, t] })
                    setNewTag('')
                  }}
                >
                  <input className="input !min-h-9 w-32" placeholder="+ tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
                </form>
              </div>
            </div>

            <label>
              <span className="label">Notes</span>
              <textarea
                className="input min-h-24"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value)
                  setDebounced({ notes: e.target.value })
                }}
                placeholder="Anything to remember…"
              />
            </label>
            <p className="text-center text-xs font-semibold text-muted">✓ Saved automatically</p>
          </div>
        )}
      </Sheet>

      <Sheet
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        title="Copy to which days?"
        footer={
          <button
            className="btn-primary w-full"
            disabled={!copyDates.length}
            onClick={async () => {
              if (task) await copyTaskToDates(task, copyDates)
              setCopyDates([])
              setCopyOpen(false)
            }}
          >
            Copy to {copyDates.length || ''} day{copyDates.length === 1 ? '' : 's'}
          </button>
        }
      >
        <MultiDatePicker value={copyDates} onChange={setCopyDates} />
      </Sheet>
    </>
  )
}

export const newTaskId = () => uid()
