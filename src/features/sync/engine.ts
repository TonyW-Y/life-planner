import type { RealtimeChannel } from '@supabase/supabase-js'
import { create } from 'zustand'
import { db, mergeRecords, onLocalChange } from '../../data/db'
import { supabase, syncConfigured } from '../../data/supabase'
import { SYNCED_TABLES, type Base, type TableName } from '../../data/types'
import { registerFlush } from '../../lib/lifecycle'
import { ensurePushSubscription } from '../reminders/push'

type Status = 'off' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error'

export const useSync = create<{ status: Status; lastSync: number | null; error?: string; email?: string }>(() => ({
  status: syncConfigured ? 'signed-out' : 'off',
  lastSync: null,
}))
const set = useSync.setState

const CURSOR = 'sync:cursor'
const FULL_PUSH = 'sync:fullPushDone'
const getMeta = async <T,>(k: string) => (await db.drafts.get(k))?.value as T | undefined
const setMeta = (k: string, v: unknown) => db.drafts.put({ key: k, value: v, at: Date.now() })

/** Apply a remote record locally without echoing it back to the server. */
async function applyRemote(tbl: string, data: Base) {
  if (!SYNCED_TABLES.includes(tbl as TableName)) return
  const t = db.table(tbl)
  await db.transaction('rw', t, async () => {
    const local = (await t.get(data.id)) as Base | undefined
    await t.put(mergeRecords(local, data))
  })
}

async function pull() {
  if (!supabase) return
  let cursor = (await getMeta<string>(CURSOR)) ?? '1970-01-01T00:00:00Z'
  for (;;) {
    const { data, error } = await supabase.from('records').select('tbl,id,data,server_ts').gte('server_ts', cursor).order('server_ts').limit(500)
    if (error) throw error
    if (!data.length) break
    for (const r of data) await applyRemote(r.tbl, r.data as Base)
    const last = data[data.length - 1].server_ts as string
    if (last === cursor && data.length < 500) break
    cursor = last
    await setMeta(CURSOR, cursor)
    if (data.length < 500) break
  }
}

async function pushRows(rows: { tbl: string; id: string; data: unknown }[]) {
  if (!supabase || !rows.length) return
  // batch by size so images don't make one giant request
  let batch: typeof rows = []
  let size = 0
  const flush = async () => {
    if (!batch.length) return
    const { error } = await supabase!.rpc('push_records', { rows: batch })
    if (error) throw error
    batch = []
    size = 0
  }
  for (const r of rows) {
    const s = JSON.stringify(r.data).length
    if (size + s > 1_500_000) await flush()
    batch.push(r)
    size += s
  }
  await flush()
}

async function fullPush() {
  const rows: { tbl: string; id: string; data: unknown }[] = []
  for (const tbl of SYNCED_TABLES) for (const r of (await db.table(tbl).toArray()) as Base[]) rows.push({ tbl, id: r.id, data: r })
  await pushRows(rows)
  await setMeta(FULL_PUSH, true)
}

async function pushOutbox() {
  const items = await db.outbox.toArray()
  if (!items.length) return
  const maxSeq = items[items.length - 1].seq!
  const seen = new Set<string>()
  const rows: { tbl: string; id: string; data: unknown }[] = []
  for (const it of items) {
    const k = `${it.table}:${it.id}`
    if (seen.has(k)) continue
    seen.add(k)
    const data = await db.table(it.table).get(it.id)
    if (data) rows.push({ tbl: it.table, id: it.id, data })
  }
  await pushRows(rows)
  // only clear what we sent; anything saved meanwhile stays queued
  await db.outbox.where('seq').belowOrEqual(maxSeq).delete()
}

let running: Promise<void> | null = null
let again = false
/** Push local changes, then pull remote ones. Safe to call often. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    try {
      if (!supabase) return
      const { data } = await supabase.auth.getSession()
      if (!data.session) return set({ status: 'signed-out' })
      if (!navigator.onLine) return set({ status: 'offline' })
      set({ status: 'syncing', email: data.session.user.email })
      if (!(await getMeta(FULL_PUSH))) await fullPush()
      await pushOutbox()
      await pull()
      set({ status: 'synced', lastSync: Date.now(), error: undefined })
    } catch (e) {
      set({ status: navigator.onLine ? 'error' : 'offline', error: (e as Error).message })
    } finally {
      running = null
      if (again) {
        again = false
        void syncNow()
      }
    }
  })()
  return running
}

let channel: RealtimeChannel | null = null
let started = false

export async function startSync() {
  if (started) return
  started = true
  if (!supabase) {
    // local-only: nothing will ever read the outbox, keep it small.
    // (Signing in later uploads everything in one go.)
    await db.outbox.clear()
    return
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  onLocalChange(() => {
    clearTimeout(timer)
    timer = setTimeout(() => void syncNow(), 800)
  })
  registerFlush(() => syncNow())
  window.addEventListener('online', () => void syncNow())
  window.addEventListener('offline', () => set({ status: 'offline' }))
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void syncNow())
  setInterval(() => void syncNow(), 60_000)

  const subscribe = async () => {
    const { data } = await supabase!.auth.getSession()
    channel?.unsubscribe()
    channel = null
    if (!data.session) return
    channel = supabase!
      .channel('records')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `user_id=eq.${data.session.user.id}` }, (p) => {
        const r = p.new as { tbl?: string; data?: Base }
        if (r?.tbl && r.data) void applyRemote(r.tbl, r.data)
      })
      .subscribe()
  }
  supabase.auth.onAuthStateChange((evt) => {
    if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT' || evt === 'INITIAL_SESSION') {
      void subscribe()
      void syncNow()
      void ensurePushSubscription()
    }
  })
}

export async function signOut() {
  await syncNow()
  await supabase?.auth.signOut()
  await db.drafts.bulkDelete([CURSOR, FULL_PUSH])
  set({ status: 'signed-out', email: undefined })
}
