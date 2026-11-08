import type { ReactNode } from 'react'

const Teddy = () => (
  <svg viewBox="0 0 60 60" width="100%" height="100%">
    <circle cx="14" cy="14" r="9" fill="#c98a5e" /><circle cx="46" cy="14" r="9" fill="#c98a5e" />
    <circle cx="14" cy="14" r="4.5" fill="#f2c9a8" /><circle cx="46" cy="14" r="4.5" fill="#f2c9a8" />
    <circle cx="30" cy="30" r="20" fill="#d99a6c" />
    <ellipse cx="30" cy="37" rx="9" ry="7" fill="#f2c9a8" />
    <circle cx="23" cy="27" r="2.4" fill="#3b2418" /><circle cx="37" cy="27" r="2.4" fill="#3b2418" />
    <ellipse cx="30" cy="34" rx="3" ry="2.2" fill="#3b2418" />
    <path d="M27 39 Q30 42 33 39" stroke="#3b2418" strokeWidth="1.4" fill="none" />
    <g transform="translate(30 52)"><path d="M0 0 L-9 -5 L-9 5Z M0 0 L9 -5 L9 5Z" fill="#ff86b0" /><circle r="2.5" fill="#ff5c95" /></g>
  </svg>
)
const Bow = () => (
  <svg viewBox="0 0 40 24" width="100%" height="100%">
    <path d="M20 12 L3 2 Q0 12 3 22Z" fill="#ff9cc0" /><path d="M20 12 L37 2 Q40 12 37 22Z" fill="#ff9cc0" />
    <circle cx="20" cy="12" r="4.5" fill="#ff6fa3" />
  </svg>
)
const Heart = () => (
  <svg viewBox="0 0 24 22" width="100%" height="100%">
    <path d="M12 21 C-4 10 4 -3 12 5 C20 -3 28 10 12 21Z" fill="#ffb3cf" />
  </svg>
)
const Sparkle = () => (
  <svg viewBox="0 0 20 20" width="100%" height="100%">
    <path d="M10 0 Q11.5 8.5 20 10 Q11.5 11.5 10 20 Q8.5 11.5 0 10 Q8.5 8.5 10 0Z" fill="#ffd36e" />
  </svg>
)

const ITEMS: Array<{ el: ReactNode; top: string; left: string; size: number; rot: number; tw?: boolean }> = [
  { el: <Teddy />, top: '8%', left: '88%', size: 54, rot: 12 },
  { el: <Teddy />, top: '78%', left: '3%', size: 48, rot: -10 },
  { el: <Bow />, top: '3%', left: '42%', size: 36, rot: -8 },
  { el: <Bow />, top: '55%', left: '93%', size: 30, rot: 20 },
  { el: <Heart />, top: '22%', left: '5%', size: 22, rot: -15, tw: true },
  { el: <Heart />, top: '66%', left: '60%', size: 18, rot: 10, tw: true },
  { el: <Heart />, top: '40%', left: '80%', size: 16, rot: 0, tw: true },
  { el: <Sparkle />, top: '14%', left: '22%', size: 16, rot: 0, tw: true },
  { el: <Sparkle />, top: '48%', left: '12%', size: 14, rot: 0, tw: true },
  { el: <Sparkle />, top: '88%', left: '75%', size: 18, rot: 0, tw: true },
  { el: <Sparkle />, top: '30%', left: '66%', size: 12, rot: 0, tw: true },
]

/** Floating teddies, bows, hearts and sparkles for Joey Mode. Decorative only. */
export function JoeyDecor() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {ITEMS.map((it, i) => (
        <div
          key={i}
          className="absolute opacity-60"
          style={{
            top: it.top,
            left: it.left,
            width: it.size,
            height: it.size,
            transform: `rotate(${it.rot}deg)`,
            animation: it.tw ? `twinkle ${3 + (i % 3)}s ease-in-out ${i * 0.4}s infinite` : `bob ${5 + (i % 2)}s ease-in-out infinite`,
          }}
        >
          {it.el}
        </div>
      ))}
    </div>
  )
}
