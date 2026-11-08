import type { Technique } from '../data/types'

export type Phase = 'focus' | 'break' | 'long'

export interface CustomTimes {
  focus: number
  brk: number
  long: number
  every: number
}

/**
 * The timer is stored as timestamps, never as a ticking counter,
 * so closing the app (or switching devices) never loses or freezes time.
 */
export interface TimerState {
  technique: Technique
  phase: Phase
  running: boolean
  /** when the current running segment began (ms) */
  segStart: number
  /** ms already counted before the last pause */
  elapsedBefore: number
  /** 0 = counts up (Flowtime focus) */
  durationMs: number
  round: number
  subject: string
  taskId?: string | null
  /** when this focus phase first started (for the session log) */
  focusStartedAt?: number | null
  custom: CustomTimes
}

export const TECHNIQUES: Record<Technique, { name: string; emoji: string; blurb: string; focus: number; brk: number; long: number; every: number }> = {
  pomodoro: { name: 'Pomodoro', emoji: '🍅', blurb: '25 min focus, 5 min break. Long 15 min break every 4 rounds.', focus: 25, brk: 5, long: 15, every: 4 },
  '5217': { name: '52 / 17', emoji: '🌊', blurb: '52 min deep work, 17 min real break. Great for long study days.', focus: 52, brk: 17, long: 17, every: 99 },
  ultradian: { name: 'Ultradian 90', emoji: '🧠', blurb: "90 min focus matched to your brain's natural rhythm, then 20 min rest.", focus: 90, brk: 20, long: 20, every: 99 },
  flowtime: { name: 'Flowtime', emoji: '🌸', blurb: 'Focus as long as it feels good. Your break grows with how long you worked.', focus: 0, brk: 0, long: 0, every: 99 },
  custom: { name: 'Custom', emoji: '🎀', blurb: 'Your own focus and break lengths.', focus: 30, brk: 5, long: 15, every: 4 },
}

export const DEFAULT_CUSTOM: CustomTimes = { focus: 30, brk: 5, long: 15, every: 4 }

export function config(t: Technique, custom: CustomTimes) {
  const c = TECHNIQUES[t]
  return t === 'custom' ? { ...c, ...custom } : c
}

export function phaseDuration(t: Technique, phase: Phase, custom: CustomTimes, lastFocusMs = 0): number {
  const c = config(t, custom)
  if (t === 'flowtime') {
    if (phase === 'focus') return 0
    // ~1/5 of focus time, between 5 and 30 minutes
    return Math.min(30, Math.max(5, Math.round(lastFocusMs / 60000 / 5))) * 60000
  }
  return (phase === 'focus' ? c.focus : phase === 'long' ? c.long : c.brk) * 60000
}

export function newTimer(t: Technique, subject = '', custom = DEFAULT_CUSTOM): TimerState {
  return {
    technique: t,
    phase: 'focus',
    running: false,
    segStart: 0,
    elapsedBefore: 0,
    durationMs: phaseDuration(t, 'focus', custom),
    round: 1,
    subject,
    custom,
    focusStartedAt: null,
  }
}

export const elapsed = (s: TimerState, now: number) => s.elapsedBefore + (s.running ? now - s.segStart : 0)
export const remaining = (s: TimerState, now: number) => (s.durationMs ? Math.max(0, s.durationMs - elapsed(s, now)) : 0)
export const isOver = (s: TimerState, now: number) => s.running && s.durationMs > 0 && elapsed(s, now) >= s.durationMs
/** the moment the current phase ends (ms), or null for count-up */
export const endsAt = (s: TimerState) => (s.running && s.durationMs ? s.segStart + s.durationMs - s.elapsedBefore : null)

export function start(s: TimerState, now: number): TimerState {
  if (s.running) return s
  return { ...s, running: true, segStart: now, focusStartedAt: s.phase === 'focus' ? (s.focusStartedAt ?? now) : s.focusStartedAt }
}
export function pause(s: TimerState, now: number): TimerState {
  if (!s.running) return s
  return { ...s, running: false, elapsedBefore: elapsed(s, now), segStart: 0 }
}

export interface Completed {
  next: TimerState
  /** minutes of focus to log, if a focus phase just ended */
  focusMins: number
  focusStart?: number
  focusEnd?: number
}

/**
 * Finish the current phase (because time ran out, or the person tapped "done"/"skip")
 * and move to the next. `at` is when the phase actually ended, which may be in the past
 * if the app was closed — the next phase then starts from that moment.
 */
export function advance(s: TimerState, at: number, opts: { autoStartBreak?: boolean; autoStartFocus?: boolean } = {}): Completed {
  const { autoStartBreak = true, autoStartFocus = false } = opts
  const worked = Math.min(elapsed(s, at), s.durationMs || Infinity)
  if (s.phase === 'focus') {
    const c = config(s.technique, s.custom)
    const long = s.technique !== 'flowtime' && s.round % c.every === 0
    const phase: Phase = long ? 'long' : 'break'
    const next: TimerState = {
      ...s,
      phase,
      durationMs: phaseDuration(s.technique, phase, s.custom, worked),
      elapsedBefore: 0,
      running: autoStartBreak,
      segStart: autoStartBreak ? at : 0,
      focusStartedAt: null,
    }
    return { next, focusMins: Math.round(worked / 60000), focusStart: s.focusStartedAt ?? at - worked, focusEnd: at }
  }
  const next: TimerState = {
    ...s,
    phase: 'focus',
    round: s.round + 1,
    durationMs: phaseDuration(s.technique, 'focus', s.custom),
    elapsedBefore: 0,
    running: autoStartFocus,
    segStart: autoStartFocus ? at : 0,
    focusStartedAt: autoStartFocus ? at : null,
  }
  return { next, focusMins: 0 }
}

export const fmtClock = (ms: number) => {
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
