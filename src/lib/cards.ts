import type { CardType, Mask } from '../data/types'

const CLOZE_RE = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g

/** Which cloze numbers appear in the text: "{{c1::aspirin}} inhibits {{c2::COX}}" → [1, 2] */
export function clozeNumbers(text: string): number[] {
  return [...new Set([...text.matchAll(CLOZE_RE)].map((m) => +m[1]))].sort((a, b) => a - b)
}

export type Seg = { text: string; kind: 'plain' | 'blank' | 'answer' | 'other' }

/** Split a cloze note for display. The tested number is blanked (or shown as the answer). */
export function renderCloze(text: string, n: number, reveal: boolean): Seg[] {
  const segs: Seg[] = []
  let last = 0
  for (const m of text.matchAll(CLOZE_RE)) {
    if (m.index! > last) segs.push({ text: text.slice(last, m.index), kind: 'plain' })
    const num = +m[1]
    if (num === n) segs.push(reveal ? { text: m[2], kind: 'answer' } : { text: m[3] ? `[${m[3]}]` : '[ … ]', kind: 'blank' })
    else segs.push({ text: m[2], kind: 'other' })
    last = m.index! + m[0].length
  }
  if (last < text.length) segs.push({ text: text.slice(last), kind: 'plain' })
  return segs
}

export interface NoteInput {
  type: CardType
  front: string
  back: string
  masks?: Mask[]
}

/** Which "sub" cards a note produces: one per direction / cloze number / mask. */
export function subsFor(note: NoteInput): number[] {
  switch (note.type) {
    case 'basic':
      return [0]
    case 'reversed':
      return [0, 1]
    case 'cloze': {
      const n = clozeNumbers(note.front)
      return n.length ? n : [1]
    }
    case 'occlusion':
      return (note.masks ?? []).map((_, i) => i)
  }
}

/** Parse pasted/imported text into [front, back] pairs. Handles Anki TSV, CSV, "Q :: A", "Q - A", "Q? A". */
export function parseCardsText(raw: string): [string, string][] {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() && !l.startsWith('#'))
  if (!lines.length) return []
  const sample = lines.slice(0, 10).join('\n')
  // CSV only when the file looks like CSV (no tabs / :: anywhere)
  const csv = !sample.includes('\t') && !/(^|[^{])::/.test(sample.replace(/\{\{c\d+::.*?\}\}/g, '')) && sample.includes(',') && !sample.includes(';')
  const out: [string, string][] = []
  for (const line of lines) {
    let parts: string[] = [line]
    const noCloze = line.replace(/\{\{c\d+::.*?\}\}/g, (m) => '\u0000'.repeat(m.length))
    const delim = ['\t', '::', ';'].find((d) => noCloze.includes(d))
    if (delim) {
      const i = noCloze.indexOf(delim)
      parts = [line.slice(0, i), line.slice(i + delim.length)]
    } else if (csv) parts = splitCsv(line)
    else if (noCloze.includes(' - ')) {
      const i = noCloze.indexOf(' - ')
      parts = [line.slice(0, i), line.slice(i + 3)]
    } else {
      const q = noCloze.indexOf('?')
      if (q !== -1 && q < line.length - 1) parts = [line.slice(0, q + 1), line.slice(q + 1)]
    }
    const f = clean(parts[0] ?? '')
    const b = clean(parts.slice(1).join(csv ? ', ' : ' ') ?? '')
    if (f && (b || /\{\{c\d+::/.test(f))) out.push([f, b])
  }
  return out
}

const clean = (s: string) =>
  s
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/""/g, '"')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()

function splitCsv(line: string) {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"'
        i++
      } else q = !q
    } else if (ch === ',' && !q) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}
