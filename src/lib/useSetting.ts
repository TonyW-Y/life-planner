import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting } from '../data/db'

/** Reactive setting backed by IndexedDB (and synced). */
export function useSetting<T>(key: string, fallback: T): [T, (v: T) => Promise<void>, boolean] {
  const row = useLiveQuery(() => db.settings.get(key), [key], null)
  const loaded = row !== null
  const value = row ? (row.value as T) : fallback
  return [value, (v: T) => setSetting(key, v), loaded]
}

export type ThemeName = 'light' | 'dark' | 'brown' | 'joey'
