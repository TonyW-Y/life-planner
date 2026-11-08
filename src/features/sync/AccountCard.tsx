import { formatDistanceToNow } from 'date-fns'
import { useEffect, useState } from 'react'
import { supabase, syncConfigured } from '../../data/supabase'
import { toast } from '../../lib/toast'
import { signOut, syncNow, useSync } from './engine'

const FREE_DB_BYTES = 500 * 1024 * 1024

export function AccountCard() {
  const { status, lastSync, email, error } = useSync()
  const [input, setInput] = useState('')
  const [sent, setSent] = useState(false)
  const [usage, setUsage] = useState<number | null>(null)

  useEffect(() => {
    if (status !== 'synced' || !supabase) return
    supabase.rpc('db_usage').then(({ data }) => typeof data === 'number' && setUsage(data))
  }, [status])

  if (!syncConfigured)
    return (
      <section className="card flex flex-col gap-2">
        <h2 className="h2">Sync between devices ☁️</h2>
        <p className="text-sm font-semibold text-muted">
          Sync isn't set up yet, so everything is saved on this device only. To use the same planner on your phone and laptop, connect a free Supabase project (see SETUP.md — about 10 minutes, no credit card).
        </p>
      </section>
    )

  const pct = usage ? usage / FREE_DB_BYTES : 0
  return (
    <section className="card flex flex-col gap-3">
      <h2 className="h2">Sync between devices ☁️</h2>
      {status === 'signed-out' ? (
        sent ? (
          <p className="font-bold">💌 Check your email for a magic link! Open it on this device to sign in.</p>
        ) : (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              const { error } = await supabase!.auth.signInWithOtp({ email: input.trim(), options: { emailRedirectTo: window.location.origin } })
              if (error) toast(error.message, { emoji: '⚠️' })
              else setSent(true)
            }}
          >
            <input type="email" required className="input min-w-0 flex-1" placeholder="your@email.com" value={input} onChange={(e) => setInput(e.target.value)} />
            <button className="btn-primary">Send magic link</button>
            <p className="w-full text-xs font-semibold text-muted">No password needed. Use the same email on every device.</p>
          </form>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{email}</span>
            <span className={`chip !min-h-8 text-xs ${status === 'error' ? '!border-warn' : ''}`}>
              {status === 'synced' ? '✓ Synced' : status === 'syncing' ? '⟳ Syncing…' : status === 'offline' ? '☁️ Offline — will sync when back' : '⚠️ Having trouble syncing'}
            </span>
          </div>
          {lastSync && <p className="text-xs font-semibold text-muted">Last synced {formatDistanceToNow(lastSync, { addSuffix: true })}</p>}
          {status === 'error' && <p className="text-xs text-muted">{error} — your changes are safe on this device and will retry automatically.</p>}
          {usage !== null && (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct * 100)}%`, background: pct > 0.8 ? 'var(--warn)' : 'var(--accent)' }} />
              </div>
              <p className="mt-1 text-xs font-semibold text-muted">
                {(usage / 1024 / 1024).toFixed(0)} MB of the free 500 MB used{pct > 0.8 ? ' — getting full! Delete old image cards or empty the trash.' : ''}
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn-soft" onClick={() => syncNow()}>⟳ Sync now</button>
            <button className="btn-ghost" onClick={() => signOut()}>Sign out</button>
          </div>
        </>
      )}
    </section>
  )
}
