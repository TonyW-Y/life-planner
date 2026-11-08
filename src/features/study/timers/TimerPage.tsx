import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { startOfDay } from 'date-fns'
import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { db } from '../../../data/db'
import type { Technique } from '../../../data/types'
import { PomPals } from '../../pups/PomPals'
import { TECHNIQUES, elapsed, fmtClock, newTimer, remaining, type CustomTimes } from '../../../lib/timer'
import { AMBIENTS, playAmbient, stopAmbient, type Ambient } from '../../../lib/sounds'
import { askNotificationPermission } from '../../../lib/notify'
import { useSetting } from '../../../lib/useSetting'
import { completePhase, pauseTimer, startTimer, stopTimer, useNow, useTimerState } from '../useTimer'

const BREAK_IDEAS = [
  '🧘‍♀️ Stretch your neck and shoulders',
  '💧 Drink a glass of water',
  '👀 Look at something 20 feet away for 20 seconds',
  '🚶‍♀️ Walk around for a minute',
  '🍎 Grab a little snack',
  '🌬️ Do one round of box breathing',
  '🐾 Give the pups some pets (tap them!)',
  '☀️ Open a window, get some light',
]

export function TimerPage() {
  const [s, setS] = useTimerState()
  const now = useNow(s.running)
  const [params] = useSearchParams()
  const [ambient, setAmbient] = useSetting<Ambient>('ambient', 'none')
  const [volume, setVolume] = useSetting('ambientVolume', 0.5)
  const [autoBreak, setAutoBreak] = useSetting('autoStartBreaks', true)
  const [autoFocus, setAutoFocus] = useSetting('autoStartFocus', false)
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied')
  const [idea] = useState(() => Math.floor(Math.random() * BREAK_IDEAS.length))

  const subjects = useLiveQuery(async () => {
    const sess = await db.sessions.orderBy('start').reverse().limit(200).toArray()
    const exams = await db.exams.filter((e) => !e.deleted).toArray()
    return [...new Set([...sess.map((x) => x.subject), ...exams.map((e) => e.name)])].slice(0, 20)
  }, [], [] as string[])
  const today = useLiveQuery(() => db.sessions.where('start').aboveOrEqual(startOfDay(new Date()).getTime()).filter((x) => !x.deleted).toArray(), [], [])
  const todayMins = today.reduce((a, x) => a + x.focusMins, 0)

  // ?subject=… from the calendar
  useEffect(() => {
    const sub = params.get('subject')
    if (sub && !s.running && sub !== s.subject) void setS({ ...s, subject: sub })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  // ambient sound only while focusing
  useEffect(() => {
    if (s.running && s.phase === 'focus' && ambient !== 'none') playAmbient(ambient, volume)
    else stopAmbient()
    return () => stopAmbient()
  }, [s.running, s.phase, ambient, volume])

  const isFocus = s.phase === 'focus'
  const countUp = s.durationMs === 0
  const shown = countUp ? elapsed(s, now) : remaining(s, now)
  const progress = countUp ? (elapsed(s, now) % 3600000) / 3600000 : 1 - remaining(s, now) / (s.durationMs || 1)
  const pristine = !s.running && s.elapsedBefore === 0
  const R = 120
  const C = 2 * Math.PI * R

  const pickTechnique = (t: Technique) => void setS(newTimer(t, s.subject, s.custom))
  const setCustom = (p: Partial<CustomTimes>) => {
    const custom = { ...s.custom, ...p }
    void setS({ ...newTimer('custom', s.subject, custom) })
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {(Object.keys(TECHNIQUES) as Technique[]).map((t) => (
            <button
              key={t}
              disabled={!pristine && s.technique !== t}
              onClick={() => pickTechnique(t)}
              className={`min-w-36 shrink-0 rounded-3xl border-2 p-3 text-left transition disabled:opacity-40 ${s.technique === t ? 'border-primary bg-primary-soft' : 'border-line bg-surface'}`}
            >
              <div className="text-2xl">{TECHNIQUES[t].emoji}</div>
              <div className="font-extrabold">{TECHNIQUES[t].name}</div>
            </button>
          ))}
        </div>
        <p className="-mt-2 px-1 text-sm font-semibold text-muted">{TECHNIQUES[s.technique].blurb}</p>

        {s.technique === 'custom' && pristine && (
          <div className="card grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ['focus', 'Focus (min)'],
                ['brk', 'Break'],
                ['long', 'Long break'],
                ['every', 'Long every…'],
              ] as const
            ).map(([k, label]) => (
              <label key={k}>
                <span className="label">{label}</span>
                <input type="number" min={1} className="input" value={s.custom[k]} onChange={(e) => setCustom({ [k]: Math.max(1, +e.target.value || 1) })} />
              </label>
            ))}
          </div>
        )}

        <div className={`card flex flex-col items-center gap-4 py-6 transition-colors ${isFocus ? '' : '!bg-accent-soft'}`}>
          <input
            list="subjects"
            className="input max-w-sm text-center font-bold"
            placeholder="What are you studying? (e.g. Cardio pharm)"
            value={s.subject}
            onChange={(e) => void setS({ ...s, subject: e.target.value })}
          />
          <datalist id="subjects">
            {subjects.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>

          <div className="relative">
            <svg width={2 * R + 30} height={2 * R + 30} viewBox={`0 0 ${2 * R + 30} ${2 * R + 30}`} className="-rotate-90">
              <circle cx={R + 15} cy={R + 15} r={R} fill="none" stroke="var(--surface-2)" strokeWidth="18" />
              <motion.circle
                cx={R + 15}
                cy={R + 15}
                r={R}
                fill="none"
                stroke={isFocus ? 'var(--primary)' : 'var(--accent)'}
                strokeWidth="18"
                strokeLinecap="round"
                strokeDasharray={C}
                animate={{ strokeDashoffset: C * (1 - Math.min(1, Math.max(0, progress))) }}
                transition={{ duration: 0.5 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-sm font-extrabold uppercase tracking-wider text-muted">
                {isFocus ? `Focus · round ${s.round}` : s.phase === 'long' ? 'Long break ☁️' : 'Break ☁️'}
              </div>
              <div className="text-6xl font-extrabold tabular-nums" aria-live="polite">{fmtClock(shown)}</div>
              {countUp && <div className="text-xs font-bold text-muted">counting up — stop when you feel done</div>}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {s.running ? (
              <button className="btn-soft !min-h-14 !px-8 text-lg" onClick={pauseTimer}>⏸ Pause</button>
            ) : (
              <button className="btn-primary !min-h-14 !px-10 text-lg" onClick={startTimer}>▶ {pristine ? 'Start' : 'Resume'}</button>
            )}
            {(!pristine || !isFocus) && (
              <button className="btn-soft !min-h-14" onClick={() => completePhase(true)}>
                {isFocus ? (countUp ? '☕ Take a break' : '✓ Done early') : '⏭ Skip break'}
              </button>
            )}
            {!pristine && (
              <button className="btn-ghost !min-h-14" onClick={stopTimer} title="Stop and save the time you've done">
                ⏹ Stop
              </button>
            )}
          </div>

          {!isFocus && (
            <div className="rounded-2xl bg-surface px-4 py-3 text-center font-bold">
              Break idea: {BREAK_IDEAS[(idea + s.round) % BREAK_IDEAS.length]}
              <div className="mt-1 text-sm">
                <Link to="/tt?breathe=1" className="text-primary underline">Try a 1-minute breathing bubble →</Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="card flex flex-col items-center">
          <PomPals size={100} />
          <div className="mt-2 text-center text-sm font-bold text-muted">
            {s.running && isFocus ? 'The pups are napping while you focus 💤' : 'Tap the pups for encouragement'}
          </div>
        </div>

        <div className="card">
          <div className="h2 mb-1">Today</div>
          <div className="text-3xl font-extrabold">
            {Math.floor(todayMins / 60)}h {todayMins % 60}m <span className="text-base text-muted">focused</span>
          </div>
          <div className="text-sm font-semibold text-muted">{today.length} session{today.length === 1 ? '' : 's'} 🌟</div>
        </div>

        <div className="card flex flex-col gap-2">
          <div className="h2">Focus sounds</div>
          <div className="flex flex-wrap gap-2">
            {AMBIENTS.map((a) => (
              <button key={a.id} className={`chip ${ambient === a.id ? 'chip-on' : ''}`} onClick={() => setAmbient(a.id)}>
                {a.emoji} {a.label}
              </button>
            ))}
          </div>
          {ambient !== 'none' && (
            <input type="range" min={0.05} max={1} step={0.05} value={volume} onChange={(e) => setVolume(+e.target.value)} aria-label="Volume" className="accent-[var(--primary)]" />
          )}
          <p className="text-xs text-muted">Plays during focus, fades out on breaks.</p>
        </div>

        <div className="card flex flex-col gap-2">
          <label className="flex items-center justify-between font-bold">
            Start breaks automatically
            <input type="checkbox" className="h-6 w-6 accent-[var(--primary)]" checked={autoBreak} onChange={(e) => setAutoBreak(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between font-bold">
            Start next focus automatically
            <input type="checkbox" className="h-6 w-6 accent-[var(--primary)]" checked={autoFocus} onChange={(e) => setAutoFocus(e.target.checked)} />
          </label>
          {perm !== 'granted' && (
            <button className="btn-soft mt-1" onClick={async () => setPerm((await askNotificationPermission()) as NotificationPermission)}>
              🔔 Let me notify you when time's up
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
