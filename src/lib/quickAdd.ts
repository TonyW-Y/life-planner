import * as chrono from 'chrono-node'
import { addDays, addMinutes, startOfDay } from 'date-fns'
import type { Category, Priority, Repeat } from '../data/types'
import { fmtD, monIndex } from './recurrence'

export interface Parsed {
  title: string
  start: Date | null
  end: Date | null
  hasTime: boolean
  durationMins: number | null
  repeat: Repeat | null
  priority: Priority | null
  tags: string[]
  category: Category
}

const DAYS: Record<string, number> = {
  mon: 0, monday: 0, mondays: 0,
  tue: 1, tues: 1, tuesday: 1, tuesdays: 1,
  wed: 2, weds: 2, wednesday: 2, wednesdays: 2,
  thu: 3, thur: 3, thurs: 3, thursday: 3, thursdays: 3,
  fri: 4, friday: 4, fridays: 4,
  sat: 5, saturday: 5, saturdays: 5,
  sun: 6, sunday: 6, sundays: 6,
}
const DAY_RE = '(?:mon(?:day)?s?|tues?(?:day)?s?|wed(?:s|nesday)?s?|thu(?:rs?)?(?:day)?s?|fri(?:day)?s?|sat(?:urday)?s?|sun(?:day)?s?)'

export function guessCategory(text: string): Category {
  const t = text.toLowerCase()
  if (/\b(exam|test|quiz|midterm|final|shelf|step ?[123]|osce|boards?)\b/.test(t)) return 'exam'
  if (/\b(lecture|class|seminar|lab|small group|pbl|tutorial)\b/.test(t)) return 'lecture'
  if (/\b(clinical|clinicals|rotation|shift|hospital|rounds|clinic|ward|preceptor)\b/.test(t)) return 'clinical'
  if (/\b(study|anki|review|read|uworld|amboss|flashcards?|practice q|qbank|notes|sketchy|pathoma|boards prep)\b/.test(t)) return 'study'
  if (/\b(nap|rest|break|relax|sleep|spa|self[- ]care|meditat\w*)\b/.test(t)) return 'rest'
  if (/\b(gym|workout|run|yoga|dinner|lunch|date|call|mom|dad|friends?|party|church|groceries|laundry)\b/.test(t)) return 'personal'
  return 'other'
}

export function parseQuickAdd(input: string, now = new Date()): Parsed {
  let text = ` ${input.trim()} `
  const cut = (re: RegExp) => {
    const m = text.match(re)
    if (m) text = text.replace(m[0], ' ')
    return m
  }

  // priority + tags
  let priority: Priority | null = null
  const pm = cut(/\s!(must|should|nice|high|med|low|urgent|!+)\b/i)
  if (pm) {
    const p = pm[1].toLowerCase()
    priority = p === 'must' || p === 'high' || p === 'urgent' || p.startsWith('!') ? 'must' : p === 'should' || p === 'med' ? 'should' : 'nice'
  }
  const tags: string[] = []
  let tm: RegExpMatchArray | null
  while ((tm = cut(/\s#([\w-]+)/))) tags.push(tm[1].toLowerCase())

  // until <date>
  let until: string | null = null
  const um = cut(/\s(?:until|till|til|through|thru|ending)\s+(.+?)(?=\s(?:for|every|at|from|daily|weekly|monthly|yearly)\b|\s*$)/i)
  if (um) {
    const d = chrono.parseDate(um[1], now, { forwardDate: true })
    if (d) until = fmtD(d)
    else text += ` ${um[0]}`
  }

  // N times
  let count: number | null = null
  const cm = cut(/\s(?:for\s+)?(\d+)\s+times\b/i)
  if (cm) count = parseInt(cm[1], 10)

  // duration
  let durationMins: number | null = null
  const dm = cut(/\sfor\s+(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?)\b/i)
  if (dm) durationMins = Math.round(parseFloat(dm[1]) * (/^h/i.test(dm[2]) ? 60 : 1))

  // repeat
  let repeat: Repeat | null = null
  const daysList = new RegExp(`\\s(?:every|each|on)\\s+(${DAY_RE}(?:(?:\\s*,\\s*|\\s+and\\s+|\\s*&\\s*|\\s+|\\s*/\\s*)${DAY_RE})*)\\b`, 'i')
  let m: RegExpMatchArray | null
  if ((m = cut(/\s(?:every\s*day|everyday|daily|each day)\b/i))) repeat = { freq: 'daily', interval: 1 }
  else if ((m = cut(/\s(?:every\s+)?week\s*days?\b|\severy\s+weekday\b|\smon(?:day)?\s*(?:-|–|to)\s*fri(?:day)?\b/i))) repeat = { freq: 'weekdays', interval: 1 }
  else if ((m = cut(/\severy\s+(\d+)\s+days\b/i))) repeat = { freq: 'daily', interval: +m[1] }
  else if ((m = cut(/\severy\s+(\d+)\s+weeks\b/i))) repeat = { freq: 'weekly', interval: +m[1] }
  else if ((m = cut(/\s(?:every\s+other\s+week|biweekly|fortnightly)\b/i))) repeat = { freq: 'weekly', interval: 2 }
  else if ((m = cut(/\s(?:every\s+week|weekly|each week)\b/i))) repeat = { freq: 'weekly', interval: 1 }
  else if ((m = cut(/\s(?:every\s+month|monthly|each month)\b/i))) repeat = { freq: 'monthly', interval: 1, monthlyMode: 'date' }
  else if ((m = cut(/\s(?:every\s+year|yearly|annually|each year)\b/i))) repeat = { freq: 'yearly', interval: 1 }

  // explicit day list: "every mon wed fri" / "on mon and thu" (only counts as repeat with every/each or a weekly repeat)
  const dl = text.match(daysList)
  if (dl && (/^\s(every|each)/i.test(dl[0]) || repeat?.freq === 'weekly')) {
    text = text.replace(dl[0], ' ')
    const days = [...dl[1].toLowerCase().matchAll(new RegExp(DAY_RE, 'gi'))].map((x) => DAYS[x[0].toLowerCase()]).filter((x) => x !== undefined)
    repeat = { freq: 'weekly', interval: repeat?.interval ?? 1, byweekday: [...new Set(days)].sort() }
  }
  if (repeat) {
    repeat.until = until
    repeat.count = until ? null : count
  }

  // date/time
  let start: Date | null = null
  let end: Date | null = null
  let hasTime = false
  const results = chrono.parse(text, now, { forwardDate: true })
  if (results.length) {
    const r = results[0]
    start = r.start.date()
    hasTime = r.start.isCertain('hour')
    if (r.end) end = r.end.date()
    text = text.replace(r.text, ' ')
  }

  // weekly day list without explicit date → first matching day from today
  if (repeat?.freq === 'weekly' && repeat.byweekday?.length && (!start || !results[0]?.start.isCertain('day'))) {
    const base = start ?? startOfDay(now)
    for (let i = 0; i < 7; i++) {
      const d = addDays(startOfDay(now), i)
      if (repeat.byweekday.includes(monIndex(d))) {
        start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), base.getHours(), base.getMinutes())
        break
      }
    }
  }
  if (!start && repeat) start = startOfDay(now)
  if (start && hasTime && !end) end = addMinutes(start, durationMins ?? 60)
  if (start && hasTime && end && durationMins && results[0] && !results[0].end) end = addMinutes(start, durationMins)

  const title = text.replace(/\s+/g, ' ').replace(/\s+(at|on|from|by)\s*$/i, '').trim() || input.trim()
  return {
    title,
    start,
    end,
    hasTime,
    durationMins,
    repeat,
    priority,
    tags,
    category: guessCategory(input),
  }
}
