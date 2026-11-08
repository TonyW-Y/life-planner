import { useEffect, useState } from 'react'
import { getSetting, save, setSetting } from '../../data/db'
import type { StudySession } from '../../data/types'
import { useSetting } from '../../lib/useSetting'
import { advance, endsAt, isOver, newTimer, pause, start, type TimerState } from '../../lib/timer'
import { pupsReact, usePups } from '../../lib/pupBus'
import { chime } from '../../lib/sounds'
import { notify } from '../../lib/notify'
import { toast } from '../../lib/toast'

export const TIMER_KEY = 'timer'

export function useTimerState() {
  return useSetting<TimerState>(TIMER_KEY, newTimer('pomodoro'))
}

/** Re-render every second while running. */
export function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [active])
  return now
}

async function logFocus(s: TimerState, mins: number, startMs: number, endMs: number) {
  if (mins < 1) return
  await save<StudySession>('sessions', {
    technique: s.technique,
    subject: s.subject.trim() || 'Studying',
    start: startMs,
    end: endMs,
    focusMins: mins,
    taskId: s.taskId ?? null,
  })
}

let busy = false
/**
 * Finish the current phase exactly once (safe across tabs and re-renders):
 * re-reads the stored state and only advances if it hasn't changed.
 */
export async function completePhase(manual = false) {
  if (busy) return
  busy = true
  try {
    const s = await getSetting<TimerState | null>(TIMER_KEY, null)
    if (!s) return
    const now = Date.now()
    if (!manual && !isOver(s, now)) return
    const at = manual ? now : endsAt(s)!
    const autoBreak = await getSetting('autoStartBreaks', true)
    const autoFocus = await getSetting('autoStartFocus', false)
    const r = advance(s, at, { autoStartBreak: autoBreak, autoStartFocus: autoFocus })
    await setSetting(TIMER_KEY, r.next)
    if (s.phase === 'focus') {
      await logFocus(s, r.focusMins, r.focusStart!, r.focusEnd!)
      const late = Math.round((now - at) / 60000)
      pupsReact('stretch', 5000)
      if (!manual) chime()
      toast(late >= 1 ? `Your break started ${late} min ago — stretch & sip some water 💧` : `Focus done! ${r.focusMins} min 🌟 Break time`, { emoji: '🐾' })
      if (!manual) void notify('Break time! 🐾', `${r.focusMins} min of focus done${s.subject ? ` on ${s.subject}` : ''}. Stretch with the pups!`, { tag: 'timer', url: '/study/timer' })
    } else {
      pupsReact('cheer', 3000)
      if (!manual) chime()
      toast('Break over — ready when you are 💪', { emoji: '⏱️' })
      if (!manual) void notify('Break over ⏱️', 'Ready for another round? You got this.', { tag: 'timer', url: '/study/timer' })
    }
  } finally {
    busy = false
  }
}

export async function startTimer() {
  const s = await getSetting<TimerState>(TIMER_KEY, newTimer('pomodoro'))
  await setSetting(TIMER_KEY, start(s, Date.now()))
}
export async function pauseTimer() {
  const s = await getSetting<TimerState>(TIMER_KEY, newTimer('pomodoro'))
  await setSetting(TIMER_KEY, pause(s, Date.now()))
}
/** Stop and log whatever focus time happened (nothing is lost). */
export async function stopTimer() {
  const s = await getSetting<TimerState>(TIMER_KEY, newTimer('pomodoro'))
  const now = Date.now()
  if (s.phase === 'focus') {
    const worked = Math.min(s.elapsedBefore + (s.running ? now - s.segStart : 0), s.durationMs || Infinity)
    await logFocus(s, Math.round(worked / 60000), s.focusStartedAt ?? now - worked, now)
    if (worked >= 60000) toast(`Logged ${Math.round(worked / 60000)} min of focus 💛`, { emoji: '📚' })
  }
  await setSetting(TIMER_KEY, { ...newTimer(s.technique, s.subject, s.custom), round: 1 })
}

/** Mounted once at app level: finishes phases on time on any page, and after reopening the app. */
export function TimerEngine() {
  const [s] = useTimerState()
  const now = useNow(s.running)
  const setBase = usePups((p) => p.setBase)
  useEffect(() => {
    if (isOver(s, now)) void completePhase()
  }, [s, now])
  useEffect(() => {
    setBase(s.running && s.phase === 'focus' ? 'sleepy' : 'idle')
  }, [s.running, s.phase, setBase])
  return null
}
