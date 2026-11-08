import { addDays, differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import { db, remove, restore, save } from './db'
import type { CalEvent, Repeat, Task, Template, TemplateItem } from './types'
import { expandEvents, fmtD, fmtDT, nextRepeatDate, splitSeries, type Occurrence } from '../lib/recurrence'
import { toast } from '../lib/toast'
import { pupsReact } from '../lib/pupBus'
import { confetti } from '../lib/confetti'

export type EditScope = 'one' | 'following' | 'all'

const liveEvents = () => db.events.filter((e) => !e.deleted).toArray()

/* ---------------- Events ---------------- */

export async function createEvent(e: Omit<CalEvent, 'id' | 'updatedAt'> & { id?: string }) {
  return save<CalEvent>('events', e)
}

/** Apply edits to an occurrence of an event, respecting the "just this one / following / all" choice. */
export async function updateOccurrence(occ: Occurrence, patch: Partial<CalEvent>, scope: EditScope) {
  const ev = occ.event
  if (!occ.recurring || scope === 'all') {
    // shift the whole series by the same delta when moving times
    if (occ.recurring && (patch.start || patch.end)) {
      const ds = patch.start ? parseISO(patch.start).getTime() - occ.start.getTime() : 0
      const de = patch.end ? parseISO(patch.end).getTime() - occ.end.getTime() : 0
      patch = {
        ...patch,
        start: fmtDT(new Date(parseISO(ev.start).getTime() + ds)),
        end: fmtDT(new Date(parseISO(ev.end).getTime() + de)),
      }
    }
    return save<CalEvent>('events', { ...patch, id: ev.id })
  }
  if (scope === 'one') {
    await save<CalEvent>('events', { id: ev.id, exdates: [...(ev.exdates ?? []), occ.key] })
    const { id: _id, _fts, updatedAt, exdates, ...rest } = ev
    void _id; void _fts; void updatedAt; void exdates
    return save<CalEvent>('events', {
      ...rest,
      start: fmtDT(occ.start),
      end: fmtDT(occ.end),
      repeat: null,
      overrideOf: { seriesId: ev.id, occurrence: occ.key },
      ...patch,
    })
  }
  // following
  const { originalPatch, following } = splitSeries(ev, occ.key)
  await save<CalEvent>('events', originalPatch)
  return save<CalEvent>('events', { ...following, ...patch })
}

export async function deleteOccurrence(occ: Occurrence, scope: EditScope) {
  const ev = occ.event
  if (!occ.recurring || scope === 'all') {
    await remove('events', ev.id)
    toast(`Deleted “${ev.title}”`, { emoji: '🗑️', undo: () => restore('events', ev.id) })
    return
  }
  const before = { exdates: ev.exdates ?? [], repeat: ev.repeat ?? null }
  if (scope === 'one') {
    await save<CalEvent>('events', { id: ev.id, exdates: [...before.exdates, occ.key] })
  } else {
    const { originalPatch } = splitSeries(ev, occ.key)
    await save<CalEvent>('events', originalPatch)
  }
  toast(`Removed “${ev.title}”`, { emoji: '🗑️', undo: () => save<CalEvent>('events', { id: ev.id, ...before }).then(() => {}) })
}

/** Make an independent copy of one occurrence on each of the given dates (same time of day). */
export async function copyOccurrenceToDates(occ: Occurrence, dates: string[], repeat: Repeat | null = null) {
  const dur = occ.end.getTime() - occ.start.getTime()
  const { id: _i, _fts, updatedAt, exdates, overrideOf, ...base } = occ.event
  void _i; void _fts; void updatedAt; void exdates; void overrideOf
  for (const d of dates) {
    const day = parseISO(d)
    const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), occ.start.getHours(), occ.start.getMinutes())
    await save<CalEvent>('events', { ...base, start: fmtDT(s), end: fmtDT(new Date(s.getTime() + dur)), repeat })
  }
  toast(dates.length === 1 ? 'Copied 🐾' : `Copied to ${dates.length} days`, { emoji: '📋' })
}

export async function duplicateOccurrence(occ: Occurrence) {
  await copyOccurrenceToDates(occ, [fmtD(occ.start)])
}

/** Copy every event on `fromDay` to each target date as standalone events. */
export async function copyDay(fromDay: Date, targets: string[]) {
  const from = startOfDay(fromDay)
  const occs = expandEvents(await liveEvents(), from, addDays(from, 1)).filter((o) => o.start >= from)
  for (const t of targets) {
    for (const o of occs) await copyOccurrenceToDatesSilent(o, t)
  }
  toast(`Copied ${occs.length} things to ${targets.length} day${targets.length === 1 ? '' : 's'}`, { emoji: '📋' })
  return occs.length
}

/** Copy a whole week (Mon–Sun starting at weekStart) onto the week starting `toWeekStart`. */
export async function copyWeek(weekStart: Date, toWeekStarts: Date[]) {
  const from = startOfDay(weekStart)
  const occs = expandEvents(await liveEvents(), from, addDays(from, 7)).filter((o) => o.start >= from)
  for (const to of toWeekStarts) {
    for (const o of occs) {
      const offset = differenceInCalendarDays(o.start, from)
      await copyOccurrenceToDatesSilent(o, fmtD(addDays(to, offset)))
    }
  }
  toast(`Copied the week (${occs.length} things)`, { emoji: '📋' })
  return occs.length
}

async function copyOccurrenceToDatesSilent(occ: Occurrence, date: string) {
  const dur = occ.end.getTime() - occ.start.getTime()
  const { id: _i, _fts, updatedAt, exdates, overrideOf, ...base } = occ.event
  void _i; void _fts; void updatedAt; void exdates; void overrideOf
  const day = parseISO(date)
  const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), occ.start.getHours(), occ.start.getMinutes())
  await save<CalEvent>('events', { ...base, start: fmtDT(s), end: fmtDT(new Date(s.getTime() + dur)), repeat: null })
}

/* ---------------- Templates ---------------- */

const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export async function saveTemplate(name: string, kind: 'day' | 'week', start: Date) {
  const from = startOfDay(start)
  const occs = expandEvents(await liveEvents(), from, addDays(from, kind === 'day' ? 1 : 7)).filter((o) => o.start >= from)
  const items: TemplateItem[] = occs.map((o) => ({
    dayOffset: differenceInCalendarDays(o.start, from),
    title: o.event.title,
    startTime: hm(o.start),
    endTime: hm(o.end),
    category: o.event.category,
    emoji: o.event.emoji,
    allDay: o.event.allDay,
  }))
  await save<Template>('templates', { name, kind, items })
  toast(`Saved template “${name}”`, { emoji: '🧺' })
}

export async function applyTemplate(t: Template, start: Date) {
  const from = startOfDay(start)
  for (const it of t.items) {
    const day = addDays(from, it.dayOffset)
    const d = fmtD(day)
    let end = `${d}T${it.endTime}`
    if (it.endTime <= it.startTime && !it.allDay) end = `${fmtD(addDays(day, 1))}T${it.endTime}`
    await save<CalEvent>('events', {
      title: it.title,
      start: `${d}T${it.startTime}`,
      end,
      category: it.category,
      emoji: it.emoji,
      allDay: it.allDay,
      repeat: null,
    })
  }
  toast(`Added “${t.name}” 🧺`, { emoji: '✨' })
}

/* ---------------- Tasks ---------------- */

export async function createTask(t: Partial<Task> & { title: string }) {
  const last = await db.tasks.orderBy('updatedAt').last()
  return save<Task>('tasks', {
    priority: 'should',
    done: false,
    subtasks: [],
    tags: [],
    order: (last?.order ?? 0) + 1,
    ...t,
  })
}

export async function toggleTask(task: Task, el?: HTMLElement | null) {
  const done = !task.done
  await save<Task>('tasks', { id: task.id, done, doneAt: done ? Date.now() : null })
  if (done) {
    pupsReact('happy')
    const r = el?.getBoundingClientRect()
    confetti(r ? r.left + 20 : undefined, r ? r.top + r.height / 2 : undefined)
    // repeating task → schedule the next one
    if (task.repeat && task.due) {
      const existingNext = await db.tasks.filter((t) => !t.deleted && t.title === task.title && !t.done && !!t.due && t.due > task.due!).first()
      const next = nextRepeatDate(task.repeat, task.due, task.due)
      if (next && !existingNext) {
        const { id: _i, _fts, updatedAt, doneAt, ...rest } = task
        void _i; void _fts; void updatedAt; void doneAt
        await save<Task>('tasks', { ...rest, done: false, due: next, subtasks: task.subtasks.map((s) => ({ ...s, done: false })) })
      }
    }
    toast('Nice work! ✨', { emoji: '🐾', undo: () => save<Task>('tasks', { id: task.id, done: false, doneAt: null }).then(() => {}) })
  }
}

export async function snoozeTask(task: Task, days = 1) {
  const base = task.due && parseISO(task.due) > new Date() ? parseISO(task.due) : new Date()
  const prev = task.due ?? null
  await save<Task>('tasks', { id: task.id, due: fmtD(addDays(base, days)) })
  toast(days === 1 ? 'Moved to tomorrow 🌙' : `Snoozed ${days} days`, { emoji: '💤', undo: () => save<Task>('tasks', { id: task.id, due: prev }).then(() => {}) })
}

export async function deleteTask(task: Task) {
  await remove('tasks', task.id)
  toast(`Deleted “${task.title}”`, { emoji: '🗑️', undo: () => restore('tasks', task.id) })
}

export async function duplicateTask(task: Task) {
  const { id: _i, _fts, updatedAt, ...rest } = task
  void _i; void _fts; void updatedAt
  await save<Task>('tasks', { ...rest, done: false, doneAt: null, title: task.title })
  toast('Duplicated 🐾', { emoji: '📋' })
}

/** Copy a task to several dates. */
export async function copyTaskToDates(task: Task, dates: string[]) {
  const { id: _i, _fts, updatedAt, ...rest } = task
  void _i; void _fts; void updatedAt
  for (const d of dates) await save<Task>('tasks', { ...rest, done: false, doneAt: null, due: d, repeat: null })
  toast(`Copied to ${dates.length} day${dates.length === 1 ? '' : 's'}`, { emoji: '📋' })
}

/** Unfinished tasks from before today that can roll over. */
export async function overdueTasks() {
  const today = fmtD(new Date())
  return db.tasks.filter((t) => !t.deleted && !t.done && !!t.due && t.due < today).toArray()
}

export async function rollOver(tasks: Task[]) {
  const today = fmtD(new Date())
  for (const t of tasks) await save<Task>('tasks', { id: t.id, due: today })
  toast(`Carried over ${tasks.length} thing${tasks.length === 1 ? '' : 's'} 💛`, { emoji: '🌤️' })
}
