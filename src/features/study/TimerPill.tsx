import { Link, useLocation } from 'react-router-dom'
import { elapsed, fmtClock, remaining } from '../../lib/timer'
import { useNow, useTimerState } from './useTimer'

/** Tiny floating timer so she can peek at it from any page. */
export function TimerPill() {
  const [s] = useTimerState()
  const now = useNow(s.running)
  const loc = useLocation()
  if (loc.pathname.startsWith('/study/timer')) return null
  if (!s.running && s.elapsedBefore === 0) return null
  const t = s.durationMs ? remaining(s, now) : elapsed(s, now)
  return (
    <Link
      to="/study/timer"
      className={`fixed left-1/2 top-[max(env(safe-area-inset-top),8px)] z-40 -translate-x-1/2 rounded-full px-4 py-1.5 text-sm font-extrabold shadow-soft md:top-3 ${s.phase === 'focus' ? 'bg-primary text-primary-ink' : 'bg-accent text-ink'}`}
    >
      {s.phase === 'focus' ? '📚' : '☁️'} {fmtClock(t)} {s.running ? '' : '· paused'}
    </Link>
  )
}
