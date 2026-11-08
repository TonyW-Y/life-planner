import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import { db, exportAll, importAll, restore } from '../../data/db'
import type { Base, TableName } from '../../data/types'
import { DEFAULT_PUP_NAMES, type PupNames } from '../../features/pups/PomPals'
import { askNotificationPermission, notify } from '../../lib/notify'
import { DEFAULT_AWAKE, type Awake } from '../../lib/slots'
import { toast } from '../../lib/toast'
import { useSetting, type ThemeName } from '../../lib/useSetting'
import { Sheet } from '../../ui/Sheet'
import { AccountCard } from '../../features/sync/AccountCard'

const THEMES: { id: ThemeName; name: string; emoji: string; swatch: string[] }[] = [
  { id: 'light', name: 'Light', emoji: '☀️', swatch: ['#fff8f1', '#f19bb0', '#8fc9b9'] },
  { id: 'dark', name: 'Dark', emoji: '🌙', swatch: ['#22201f', '#c7b3f5', '#8fd0bd'] },
  { id: 'brown', name: 'Brown', emoji: '🧋', swatch: ['#f5e9dc', '#b9774a', '#d6a86b'] },
  { id: 'joey', name: 'Joey Mode', emoji: '🎀', swatch: ['#fff0f5', '#ff86b0', '#c9a7ff'] },
]

export function ThemePicker() {
  const [theme, setTheme] = useSetting<ThemeName>('theme', 'light')
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {THEMES.map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          className={`rounded-3xl border-2 p-3 text-left transition active:scale-95 ${theme === t.id ? 'border-primary bg-primary-soft' : 'border-line bg-surface'}`}
        >
          <div className="mb-2 flex gap-1">
            {t.swatch.map((c) => (
              <span key={c} className="h-6 w-6 rounded-full border border-black/10" style={{ background: c }} />
            ))}
          </div>
          <div className="font-extrabold">
            {t.emoji} {t.name}
          </div>
        </button>
      ))}
    </div>
  )
}

const download = (name: string, text: string) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function SettingsPage() {
  const [name, setName] = useSetting('userName', '')
  const [pups, setPups] = useSetting<PupNames>('pupNames', DEFAULT_PUP_NAMES)
  const [showPups, setShowPups] = useSetting('showPups', true)
  const [awake, setAwake] = useSetting<Awake>('awake', DEFAULT_AWAKE)
  const [newPerDay, setNewPerDay] = useSetting('newPerDay', 20)
  const [, setOnboarded] = useSetting('onboarded', false)
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied')
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [trashOpen, setTrashOpen] = useState(false)
  const [usage, setUsage] = useState<string>('')
  const snapshots = useLiveQuery(() => db.snapshots.orderBy('at').reverse().toArray(), [], [])

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted)
    navigator.storage?.estimate?.().then((e) => e.usage && setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB on this device`))
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">Settings ⚙️</h1>

      <section className="card flex flex-col gap-3">
        <h2 className="h2">You & the pups</h2>
        <label>
          <span className="label">Your name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="What should we call you?" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="label">🟤 Brown pom</span>
            <input className="input" value={pups.brown} onChange={(e) => setPups({ ...pups, brown: e.target.value })} />
          </label>
          <label>
            <span className="label">⚪ White pom</span>
            <input className="input" value={pups.white} onChange={(e) => setPups({ ...pups, white: e.target.value })} />
          </label>
        </div>
        <label className="flex items-center justify-between font-bold">
          Show the pups in the corner on every page
          <input type="checkbox" className="h-6 w-6 accent-[var(--primary)]" checked={showPups} onChange={(e) => setShowPups(e.target.checked)} />
        </label>
      </section>

      <section className="card">
        <h2 className="h2 mb-3">Theme</h2>
        <ThemePicker />
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="h2">Your day</h2>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="label">⏰ Usually wake up</span>
            <input type="time" className="input" value={awake.wake} onChange={(e) => setAwake({ ...awake, wake: e.target.value })} />
          </label>
          <label>
            <span className="label">🌙 Bedtime</span>
            <input type="time" className="input" value={awake.bed} onChange={(e) => setAwake({ ...awake, bed: e.target.value })} />
          </label>
        </div>
        <p className="text-xs font-semibold text-muted">Auto-fill and Find time only schedule things while you're awake.</p>
        <label className="flex items-center justify-between font-bold">
          New flashcards per day
          <input type="number" min={0} max={500} className="input !w-24" value={newPerDay} onChange={(e) => setNewPerDay(Math.max(0, +e.target.value || 0))} />
        </label>
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="h2">Reminders 🔔</h2>
        {perm === 'granted' ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-muted">✓ Notifications are on</span>
            <button className="chip" onClick={() => notify('Hi from the pups! 🐾', 'Reminders will look like this.')}>Send a test</button>
          </div>
        ) : (
          <button className="btn-primary self-start" onClick={async () => setPerm((await askNotificationPermission()) as NotificationPermission)}>
            Turn on notifications
          </button>
        )}
        <p className="text-xs font-semibold text-muted">
          On iPhone: open this site in Safari → Share → “Add to Home Screen”, then open it from the home screen and turn on notifications here. Location-based alerts only work while the app is open (a web app limit).
        </p>
      </section>

      <AccountCard />

      <section className="card flex flex-col gap-3">
        <h2 className="h2">Your data 💾</h2>
        <p className="text-sm font-semibold text-muted">
          Everything saves instantly on this device{persisted ? ' and the browser has promised not to clear it' : ''}. {usage}
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-soft" onClick={async () => download(`cozy-planner-backup-${format(new Date(), 'yyyy-MM-dd')}.json`, await exportAll())}>⬇️ Download backup</button>
          <label className="btn-soft cursor-pointer">
            ⬆️ Restore from backup
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                try {
                  await importAll(await f.text())
                  toast('Backup restored (merged with what you have) 🎉', { emoji: '💾' })
                } catch (err) {
                  toast(String((err as Error).message), { emoji: '⚠️' })
                }
              }}
            />
          </label>
          <button className="btn-soft" onClick={() => setTrashOpen(true)}>🗑️ Trash</button>
        </div>
        {snapshots.length > 0 && (
          <div className="text-sm">
            <div className="label">Automatic weekly snapshots</div>
            {snapshots.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-1">
                <span className="font-semibold">{format(s.at, 'EEE MMM d, h:mm a')}</span>
                <button className="chip !min-h-8" onClick={() => download(`cozy-snapshot-${format(s.at, 'yyyy-MM-dd')}.json`, s.json)}>Download</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card flex flex-col gap-2">
        <h2 className="h2">About</h2>
        <p className="text-sm font-semibold text-muted">
          Made with love 💕 Free forever — no ads, no subscriptions. TT is a caring companion, not a therapist; if you're struggling, please reach out to your school's counseling service or call/text 988.
        </p>
        <button className="btn-ghost self-start" onClick={() => setOnboarded(false)}>🐾 Replay the welcome tour</button>
      </section>

      <TrashSheet open={trashOpen} onClose={() => setTrashOpen(false)} />
    </div>
  )
}

const TRASH_TABLES: { t: TableName; label: string; title: (r: Record<string, unknown>) => string }[] = [
  { t: 'tasks', label: 'To-do', title: (r) => String(r.title) },
  { t: 'events', label: 'Event', title: (r) => String(r.title) },
  { t: 'decks', label: 'Deck', title: (r) => String(r.name) },
  { t: 'cards', label: 'Card', title: (r) => String(r.front || 'Image card').replace(/\{\{c\d+::(.*?)(::.*?)?\}\}/g, '$1') },
  { t: 'exams', label: 'Exam', title: (r) => String(r.name) },
  { t: 'templates', label: 'Template', title: (r) => String(r.name) },
]

function TrashSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = useLiveQuery(async () => {
    const out: { t: TableName; label: string; id: string; title: string; at: number }[] = []
    for (const x of TRASH_TABLES) {
      const rows = (await db.table(x.t).filter((r: Base) => !!r.deleted).toArray()) as (Base & Record<string, unknown>)[]
      for (const r of rows) out.push({ t: x.t, label: x.label, id: r.id, title: x.title(r), at: r.deletedAt ?? 0 })
    }
    return out.sort((a, b) => b.at - a.at)
  }, [open], [])
  return (
    <Sheet open={open} onClose={onClose} title="Trash 🗑️">
      <p className="mb-3 text-sm text-muted">Deleted things stay here for 30 days, then disappear.</p>
      <div className="flex flex-col gap-1 pb-2">
        {items.slice(0, 200).map((i) => (
          <div key={i.t + i.id} className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2">
            <span className="w-16 shrink-0 text-xs font-extrabold uppercase text-muted">{i.label}</span>
            <span className="min-w-0 flex-1 truncate font-bold">{i.title}</span>
            <span className="text-xs text-muted">{i.at ? format(i.at, 'MMM d') : ''}</span>
            <button className="chip !min-h-8" onClick={() => restore(i.t, i.id)}>Restore</button>
          </div>
        ))}
        {!items.length && <p className="py-6 text-center text-muted">Trash is empty ✨</p>}
      </div>
    </Sheet>
  )
}
