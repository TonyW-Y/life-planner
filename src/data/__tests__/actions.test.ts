import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, exportAll, importAll, mergeRecords, remove, restore, save } from '../db'
import { applyTemplate, copyDay, copyWeek, deleteOccurrence, saveTemplate, updateOccurrence } from '../actions'
import { expandEvents } from '../../lib/recurrence'
import type { CalEvent, Template } from '../types'

const live = async () => (await db.events.toArray()).filter((e) => !e.deleted)

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('saving', () => {
  it('writes durably and queues for sync', async () => {
    const e = await save<CalEvent>('events', { title: 'Lecture', start: '2026-11-09T09:00', end: '2026-11-09T10:00', category: 'lecture' })
    expect(await db.events.get(e.id)).toMatchObject({ title: 'Lecture' })
    expect(await db.outbox.count()).toBe(1)
  })
  it('delete goes to trash and can be restored', async () => {
    const e = await save<CalEvent>('events', { title: 'x', start: '2026-11-09T09:00', end: '2026-11-09T10:00', category: 'other' })
    await remove('events', e.id)
    expect((await db.events.get(e.id))?.deleted).toBe(true)
    await restore('events', e.id)
    expect((await db.events.get(e.id))?.deleted).toBe(false)
  })
  it('merges edits from two devices field by field', () => {
    const base = { id: 'a', updatedAt: 1, title: 'old', notes: 'n0', _fts: { title: 1, notes: 1 } }
    const phone = { ...base, title: 'phone title', updatedAt: 5, _fts: { title: 5, notes: 1 } }
    const laptop = { ...base, notes: 'laptop notes', updatedAt: 6, _fts: { title: 1, notes: 6 } }
    const m = mergeRecords(phone, laptop)
    expect(m.title).toBe('phone title')
    expect(m.notes).toBe('laptop notes')
  })
  it('backup round-trips', async () => {
    await save<CalEvent>('events', { title: 'keep me', start: '2026-11-09T09:00', end: '2026-11-09T10:00', category: 'other' })
    const json = await exportAll()
    await db.events.clear()
    await importAll(json)
    expect((await live())[0].title).toBe('keep me')
  })
})

describe('copying', () => {
  const day = new Date(2026, 10, 9)
  beforeEach(async () => {
    await save<CalEvent>('events', { title: 'Lecture', start: '2026-11-09T09:00', end: '2026-11-09T11:00', category: 'lecture' })
    await save<CalEvent>('events', { title: 'Anki', start: '2026-11-09T20:00', end: '2026-11-09T21:00', category: 'study' })
    await save<CalEvent>('events', { title: 'Gym', start: '2026-11-11T07:00', end: '2026-11-11T08:00', category: 'personal' })
  })

  it('copies a whole day to several dates', async () => {
    const n = await copyDay(day, ['2026-11-10', '2026-11-12'])
    expect(n).toBe(2)
    const occ = expandEvents(await live(), new Date(2026, 10, 12), new Date(2026, 10, 13))
    expect(occ.map((o) => o.event.title)).toEqual(['Lecture', 'Anki'])
    expect(await live()).toHaveLength(7)
  })

  it('copies a week to next week keeping weekdays', async () => {
    await copyWeek(day, [new Date(2026, 10, 16)])
    const occ = expandEvents(await live(), new Date(2026, 10, 16), new Date(2026, 10, 23))
    expect(occ.map((o) => [o.event.title, o.start.getDate()])).toEqual([
      ['Lecture', 16],
      ['Anki', 16],
      ['Gym', 18],
    ])
  })

  it('templates save and apply', async () => {
    await saveTemplate('Lecture day', 'day', day)
    const t = (await db.templates.toArray())[0] as Template
    expect(t.items).toHaveLength(2)
    await applyTemplate(t, new Date(2026, 11, 1))
    const occ = expandEvents(await live(), new Date(2026, 11, 1), new Date(2026, 11, 2))
    expect(occ.map((o) => o.event.title)).toEqual(['Lecture', 'Anki'])
  })
})

describe('editing repeating events', () => {
  const window = [new Date(2026, 10, 1), new Date(2026, 11, 1)] as const
  let series: CalEvent
  beforeEach(async () => {
    series = await save<CalEvent>('events', {
      title: 'Anki',
      start: '2026-11-02T20:00',
      end: '2026-11-02T21:00',
      category: 'study',
      repeat: { freq: 'daily', interval: 1, until: '2026-11-08' },
    })
  })
  const occs = async () => expandEvents(await live(), ...window)

  it('just this one', async () => {
    const o = (await occs())[2]
    await updateOccurrence(o, { title: 'Anki (short)' }, 'one')
    const all = await occs()
    expect(all).toHaveLength(7)
    expect(all.filter((x) => x.event.title === 'Anki (short)')).toHaveLength(1)
  })
  it('this and following', async () => {
    const o = (await occs())[4]
    await updateOccurrence(o, { title: 'Late Anki' }, 'following')
    const titles = (await occs()).map((x) => x.event.title)
    expect(titles).toEqual(['Anki', 'Anki', 'Anki', 'Anki', 'Late Anki', 'Late Anki', 'Late Anki'])
  })
  it('all — moving shifts every occurrence', async () => {
    const o = (await occs())[3]
    await updateOccurrence(o, { start: '2026-11-05T19:00', end: '2026-11-05T20:00' }, 'all')
    expect((await occs()).every((x) => x.start.getHours() === 19)).toBe(true)
    expect((await db.events.get(series.id))?.start).toBe('2026-11-02T19:00')
  })
  it('delete one occurrence', async () => {
    const o = (await occs())[1]
    await deleteOccurrence(o, 'one')
    expect(await occs()).toHaveLength(6)
  })
})
