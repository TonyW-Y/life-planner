import type { Freq, Repeat } from '../data/types'
import { describeRepeat, fmtD, monIndex } from '../lib/recurrence'
import { addMonths } from 'date-fns'

const FREQS: { id: Freq | 'none'; label: string }[] = [
  { id: 'none', label: 'Once' },
  { id: 'daily', label: 'Every day' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
]
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const UNIT: Record<Freq, string> = { daily: 'days', weekdays: 'weeks', weekly: 'weeks', monthly: 'months', yearly: 'years' }

export function RepeatPicker({ value, start, onChange }: { value: Repeat | null | undefined; start: Date; onChange: (r: Repeat | null) => void }) {
  const r = value ?? null
  const set = (patch: Partial<Repeat>) => onChange({ ...(r ?? { freq: 'daily', interval: 1 }), ...patch })
  const end: 'never' | 'until' | 'count' = r?.until ? 'until' : r?.count ? 'count' : 'never'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {FREQS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`chip ${(r?.freq ?? 'none') === f.id ? 'chip-on' : ''}`}
            onClick={() =>
              f.id === 'none'
                ? onChange(null)
                : onChange({
                    freq: f.id,
                    interval: 1,
                    byweekday: f.id === 'weekly' ? [monIndex(start)] : undefined,
                    monthlyMode: f.id === 'monthly' ? 'date' : undefined,
                    until: r?.until ?? null,
                    count: r?.count ?? null,
                  })
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {r && (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-3">
          {r.freq !== 'weekdays' && (
            <label className="flex items-center gap-2 text-sm font-bold">
              Every
              <input
                type="number"
                min={1}
                max={99}
                value={r.interval}
                onChange={(e) => set({ interval: Math.max(1, +e.target.value || 1) })}
                className="input !min-h-9 w-16 !px-2 text-center"
              />
              {UNIT[r.freq]}
            </label>
          )}
          {r.freq === 'weekly' && (
            <div className="flex gap-1">
              {DAYS.map((d, i) => {
                const on = r.byweekday?.includes(i)
                return (
                  <button
                    type="button"
                    key={i}
                    aria-label={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                    aria-pressed={on}
                    onClick={() => {
                      const cur = new Set(r.byweekday ?? [])
                      if (on) cur.delete(i)
                      else cur.add(i)
                      set({ byweekday: [...cur].sort() })
                    }}
                    className={`h-10 w-10 rounded-full text-sm font-extrabold transition ${on ? 'bg-primary text-primary-ink' : 'bg-surface'}`}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          )}
          {r.freq === 'monthly' && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`chip ${r.monthlyMode !== 'nth' ? 'chip-on' : ''}`} onClick={() => set({ monthlyMode: 'date' })}>
                On day {start.getDate()}
              </button>
              <button type="button" className={`chip ${r.monthlyMode === 'nth' ? 'chip-on' : ''}`} onClick={() => set({ monthlyMode: 'nth' })}>
                {describeRepeat({ freq: 'monthly', interval: 1, monthlyMode: 'nth' }, start).replace('Every month on the ', 'On the ')}
              </button>
            </div>
          )}

          <div>
            <div className="label">Ends</div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={`chip ${end === 'never' ? 'chip-on' : ''}`} onClick={() => set({ until: null, count: null })}>
                Never
              </button>
              <button
                type="button"
                className={`chip ${end === 'until' ? 'chip-on' : ''}`}
                onClick={() => set({ until: r.until ?? fmtD(addMonths(start, 1)), count: null })}
              >
                Until a date
              </button>
              <button type="button" className={`chip ${end === 'count' ? 'chip-on' : ''}`} onClick={() => set({ count: r.count ?? 10, until: null })}>
                After…
              </button>
              {end === 'until' && (
                <input type="date" className="input !min-h-9 w-auto" value={r.until ?? ''} min={fmtD(start)} onChange={(e) => set({ until: e.target.value || null })} />
              )}
              {end === 'count' && (
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input type="number" min={1} className="input !min-h-9 w-20" value={r.count ?? 1} onChange={(e) => set({ count: Math.max(1, +e.target.value || 1) })} />
                  times
                </label>
              )}
            </div>
          </div>
        </div>
      )}
      <p className="text-sm font-semibold text-muted">🔁 {describeRepeat(r, start)}</p>
    </div>
  )
}
