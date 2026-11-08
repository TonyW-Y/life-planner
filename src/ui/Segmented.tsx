export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex rounded-full border border-line bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-full font-bold transition ${size === 'sm' ? 'min-h-8 px-3 text-sm' : 'min-h-10 px-4'} ${value === o.id ? 'bg-surface shadow-soft' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
