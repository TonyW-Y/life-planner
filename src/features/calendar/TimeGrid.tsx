import { addMinutes, format, isSameDay, isToday, startOfDay } from 'date-fns'
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPE } from 'react'
import type { Task } from '../../data/types'
import { catColor } from '../../lib/categories'
import { fmtD, type Occurrence } from '../../lib/recurrence'

export const HOUR_H = 52
const SNAP = 15

interface DragState {
  kind: 'move' | 'resize' | 'task'
  occ?: Occurrence
  task?: Task
  pointerId: number
  x0: number
  y0: number
  grabMins: number
  active: boolean
  copy: boolean
  start?: Date
  end?: Date
  x?: number
  y?: number
  longPress?: ReturnType<typeof setTimeout>
}

interface Props {
  days: Date[]
  occurrences: Occurrence[]
  onEdit: (o: Occurrence) => void
  onCreate: (start: Date, end: Date) => void
  onMove: (o: Occurrence, start: Date, end: Date, copy: boolean) => void
  onPlaceTask: (t: Task, start: Date) => void
  placing: Task | null
  copyMode: boolean
  scrollToHour?: number
  registerTaskDrag?: (fn: (e: RPE, t: Task) => void) => void
}

/** Lay out overlapping events side by side. */
function layout(occs: Occurrence[]) {
  const sorted = [...occs].sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime())
  const res = new Map<Occurrence, { col: number; cols: number }>()
  let cluster: Occurrence[] = []
  let clusterEnd = 0
  const flush = () => {
    const colsEnd: number[] = []
    const assigned: [Occurrence, number][] = []
    for (const o of cluster) {
      let c = colsEnd.findIndex((e) => e <= o.start.getTime())
      if (c === -1) c = colsEnd.length
      colsEnd[c] = o.end.getTime()
      assigned.push([o, c])
    }
    for (const [o, c] of assigned) res.set(o, { col: c, cols: colsEnd.length })
    cluster = []
  }
  for (const o of sorted) {
    if (cluster.length && o.start.getTime() >= clusterEnd) flush()
    cluster.push(o)
    clusterEnd = Math.max(clusterEnd, o.end.getTime())
  }
  flush()
  return res
}

const minsOf = (d: Date, day: Date) => (d.getTime() - startOfDay(day).getTime()) / 60000

export function TimeGrid({ days, occurrences, onEdit, onCreate, onMove, onPlaceTask, placing, copyMode, scrollToHour = 7, registerTaskDrag }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const lastDragEnd = useRef(0)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, (scrollToHour - 0.5) * HOUR_H)
  }, [scrollToHour])

  const update = (d: DragState | null) => {
    dragRef.current = d
    setDrag(d ? { ...d } : null)
  }

  /** Which day column + minute is under the pointer */
  const hit = (x: number, y: number) => {
    const el = document.elementsFromPoint(x, y).find((e) => (e as HTMLElement).dataset?.day) as HTMLElement | undefined
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const day = days.find((d) => fmtD(d) === el.dataset.day)
    if (!day) return null
    return { day, mins: ((y - rect.top) / HOUR_H) * 60 }
  }
  const snap = (m: number) => Math.round(m / SNAP) * SNAP

  // global listeners while a drag is in progress
  useEffect(() => {
    if (!drag) return
    const move = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      const dist = Math.hypot(e.clientX - d.x0, e.clientY - d.y0)
      if (!d.active) {
        if (e.pointerType === 'mouse' && dist > 4) d.active = true
        else if (e.pointerType !== 'mouse' && dist > 8) {
          clearTimeout(d.longPress)
          return update(null) // it was a scroll
        } else return
      }
      d.x = e.clientX
      d.y = e.clientY
      d.copy = copyMode || e.altKey
      const h = hit(e.clientX, e.clientY)
      if (h) {
        if (d.kind === 'resize' && d.occ) {
          const m = snap(minsOf(d.occ.start, h.day) + 0) // anchored at start
          const end = addMinutes(startOfDay(h.day), Math.max(snap(h.mins), m + SNAP))
          d.start = d.occ.start
          d.end = isSameDay(h.day, d.occ.start) ? end : d.end
        } else {
          const len = d.occ ? (d.occ.end.getTime() - d.occ.start.getTime()) / 60000 : (d.task?.estimateMins ?? 60)
          const m = Math.max(0, Math.min(24 * 60 - SNAP, snap(h.mins - d.grabMins)))
          d.start = addMinutes(startOfDay(h.day), m)
          d.end = addMinutes(d.start, len)
        }
      }
      update(d)
    }
    const up = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      clearTimeout(d.longPress)
      if (d.active) lastDragEnd.current = Date.now()
      if (!d.active) {
        if (d.kind !== 'task' && d.occ) onEdit(d.occ)
      } else if (d.start && d.end) {
        if (d.kind === 'task' && d.task) onPlaceTask(d.task, d.start)
        else if (d.occ && (d.start.getTime() !== d.occ.start.getTime() || d.end.getTime() !== d.occ.end.getTime())) onMove(d.occ, d.start, d.end, d.kind === 'move' && d.copy)
      }
      update(null)
    }
    const block = (e: TouchEvent) => dragRef.current?.active && e.preventDefault()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('touchmove', block, { passive: false })
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('touchmove', block)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag, copyMode, days])

  const begin = (e: RPE, kind: DragState['kind'], occ?: Occurrence, task?: Task) => {
    if (e.button !== 0) return
    e.stopPropagation()
    let grabMins = 0
    if (occ && kind === 'move') {
      const h = hit(e.clientX, e.clientY)
      if (h) grabMins = h.mins - minsOf(occ.start, h.day)
    }
    const d: DragState = { kind, occ, task, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, grabMins, active: false, copy: copyMode || e.altKey }
    if (e.pointerType !== 'mouse') {
      d.longPress = setTimeout(() => {
        if (dragRef.current === d) {
          d.active = true
          navigator.vibrate?.(15)
          update(d)
        }
      }, 320)
    }
    update(d)
  }

  // let the task tray start drags into this grid
  useEffect(() => {
    registerTaskDrag?.((e, t) => begin(e, 'task', undefined, t))
  })

  const allDay = occurrences.filter((o) => o.event.allDay)
  const timed = occurrences.filter((o) => !o.event.allDay)
  const multi = days.length > 1

  return (
    <div className="card overflow-hidden !p-0">
      {/* header */}
      <div className="flex border-b border-line">
        <div className="w-12 shrink-0" />
        {days.map((d) => (
          <div key={d.toISOString()} className="min-w-0 flex-1 border-l border-line px-1 py-2 text-center">
            <div className="text-xs font-bold uppercase text-muted">{format(d, multi ? 'EEE' : 'EEEE')}</div>
            <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full font-extrabold ${isToday(d) ? 'bg-primary text-primary-ink' : ''}`}>{d.getDate()}</div>
            <div className="flex flex-col gap-0.5">
              {allDay
                .filter((o) => fmtD(o.start) <= fmtD(d) && fmtD(o.end) >= fmtD(d))
                .map((o) => (
                  <button
                    key={o.event.id + o.key}
                    onClick={() => onEdit(o)}
                    className="truncate rounded-lg px-1 text-left text-[11px] font-bold"
                    style={{ background: catColor(o.event.category) }}
                  >
                    {o.event.emoji} {o.event.title}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* grid */}
      <div ref={scroller} className="relative max-h-[68dvh] overflow-y-auto">
        <div className="relative flex" style={{ height: 24 * HOUR_H }}>
          <div className="w-12 shrink-0">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="relative text-right text-[10px] font-bold text-muted" style={{ height: HOUR_H }}>
                <span className="absolute -top-2 right-1">{h === 0 ? '' : format(new Date(2000, 0, 1, h), 'h a')}</span>
              </div>
            ))}
          </div>
          {days.map((day) => {
            const key = fmtD(day)
            const mine = timed.filter((o) => o.start < addMinutes(startOfDay(day), 1440) && o.end > startOfDay(day))
            const lay = layout(mine)
            return (
              <div
                key={key}
                data-day={key}
                className={`relative min-w-0 flex-1 border-l border-line ${placing ? 'cursor-copy bg-primary-soft/30' : ''}`}
                onClick={(e) => {
                  if (dragRef.current || Date.now() - lastDragEnd.current < 400) return
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  const m = Math.floor((((e.clientY - rect.top) / HOUR_H) * 60) / 30) * 30
                  const s = addMinutes(startOfDay(day), m)
                  if (placing) onPlaceTask(placing, s)
                  else onCreate(s, addMinutes(s, 60))
                }}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="border-t border-line/70" style={{ height: HOUR_H }}>
                    <div className="h-1/2 border-b border-dashed border-line/40" />
                  </div>
                ))}
                {isToday(day) && (
                  <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: (minsOf(now, day) / 60) * HOUR_H }}>
                    <span className="-ml-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    <span className="h-0.5 flex-1 bg-primary" />
                  </div>
                )}
                {mine.map((o) => {
                  const { col, cols } = lay.get(o)!
                  const top = (Math.max(0, minsOf(o.start, day)) / 60) * HOUR_H
                  const bottom = (Math.min(1440, minsOf(o.end, day)) / 60) * HOUR_H
                  const dragging = drag?.active && drag.occ === o
                  const h = Math.max(20, bottom - top - 2)
                  return (
                    <div
                      key={o.event.id + o.key}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && onEdit(o)}
                      onPointerDown={(e) => begin(e, 'move', o)}
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute z-10 select-none overflow-hidden rounded-xl border-2 border-white/60 px-1.5 py-0.5 text-left text-xs font-bold shadow-soft transition-opacity ${dragging && !drag.copy ? 'opacity-30' : ''}`}
                      style={{
                        top,
                        height: h,
                        left: `calc(${(col / cols) * 100}% + 2px)`,
                        width: `calc(${100 / cols}% - 4px)`,
                        background: catColor(o.event.category),
                        color: '#3d2b25',
                        touchAction: 'pan-y',
                      }}
                    >
                      <div className="truncate">
                        {o.event.emoji} {o.event.title} {o.recurring && <span className="opacity-60">🔁</span>}
                      </div>
                      {h > 34 && <div className="truncate font-semibold opacity-70">{format(o.start, 'h:mm')}–{format(o.end, 'h:mm a')}</div>}
                      <div
                        className="absolute inset-x-0 bottom-0 h-2.5 cursor-ns-resize"
                        onPointerDown={(e) => begin(e, 'resize', o)}
                        aria-label="Resize"
                      >
                        <div className="mx-auto mt-1 h-1 w-6 rounded-full bg-black/20" />
                      </div>
                    </div>
                  )
                })}
                {/* drop preview */}
                {drag?.active && drag.start && drag.end && fmtD(drag.start) === key && (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-30 rounded-xl border-2 border-dashed border-primary bg-primary-soft/70 px-1.5 text-xs font-extrabold"
                    style={{ top: (minsOf(drag.start, day) / 60) * HOUR_H, height: Math.max(18, ((drag.end.getTime() - drag.start.getTime()) / 3600000) * HOUR_H) }}
                  >
                    {drag.copy && drag.kind === 'move' ? '📋 ' : ''}
                    {format(drag.start, 'h:mm')}–{format(drag.end, 'h:mm a')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* floating chip while dragging a task */}
      {drag?.active && drag.kind === 'task' && drag.x !== undefined && (
        <div className="pointer-events-none fixed z-[70] -translate-x-1/2 -translate-y-full rounded-full bg-primary px-3 py-1 text-sm font-extrabold text-primary-ink shadow-soft" style={{ left: drag.x, top: (drag.y ?? 0) - 8 }}>
          {drag.task?.title}
        </div>
      )}
    </div>
  )
}
