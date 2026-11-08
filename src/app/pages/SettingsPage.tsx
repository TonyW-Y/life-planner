import { useSetting, type ThemeName } from '../../lib/useSetting'

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

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">Settings</h1>
      <section className="card">
        <h2 className="h2 mb-3">Theme</h2>
        <ThemePicker />
      </section>
    </div>
  )
}
