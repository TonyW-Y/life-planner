# 🐾 Cozy Planner

A soft, bubbly planner and study buddy made for a med student, with two fluffy Pomeranians keeping her company. Free forever.

## What's inside

**Plan everything**
- Calendar with Day / Week / Month / Agenda views. Drag to move, drag the edge to resize, Alt-drag (or "Drag copies") to copy.
- **Repeat or clone** anything: every day, weekdays, chosen weekdays, every N weeks, monthly (same date or "2nd Tuesday"), yearly. Ends on a date, after N times, or never. Edit "just this one / this and following / all".
- Copy a day or a week to other dates, "every week until…", and day/week **templates** (e.g. "Rotation week").
- To-dos with priorities, steps, tags, repeats, reminders, and an Eisenhower matrix. Swipe right to finish, swipe left for tomorrow. A gentle "carry over" for leftovers.
- **Time-blocking**: drag to-dos onto the calendar, or one-tap **Auto-fill** into free waking hours.
- Natural-language quick add everywhere: *"Anki 8pm daily until Dec 20"*, *"Lecture mon wed fri 9am for 2h"*.
- ⌘K command bar: search everything, jump anywhere, add anything.
- Reminders: in-app, plus web push when the app is closed.

**Study**
- Timers: Pomodoro, 52/17, Ultradian 90, Flowtime, Custom. They survive closing the app, include ambient sounds (rain, brown noise, ocean, fireplace), and log sessions.
- Flashcards with **FSRS spaced repetition**: basic, both-ways, fill-in (cloze), and **image occlusion** for anatomy. Anki/CSV import and a multiple-choice quiz mode.
- **Exam planner**: topics + exam date → spaced learn/review plan, placed on the calendar.
- Progress: focus per day and subject, a forgiving streak, retention, and a due-cards forecast.

**"How much time do I actually have?"**
- **My Time** turns 168 hours, minus sleep, daily life, and classes/clinicals, into her real free hours. She shares them out (study, movement, friends, date night, rest, errands) and sees done vs. planned. **Find time** handles requests like "I need 3h for pharm review". There's also a Sunday check-in.

**Feel okay**
- **TT** 🧸, a comfort companion: free AI (Groq) with an offline fallback, plus built-in crisis safety resources.
- Mood check-ins, a breathing bubble (box, 4-7-8), and affirmations.
- **Mocha & Mochi**, a brown and a white Pomeranian. They nap while she focuses, stretch on breaks, cheer when she finishes things, cuddle on rough days, and love being petted.

**Cozy looks**: Light, Dark, Brown, and **Joey Mode** 🎀 (pink, with teddy bears, bows, hearts, and sparkles, and the pups wear bows).

**Never loses anything**: instant saves on the device, drafts saved as she types, timer stored as timestamps, undo, a 30-day trash, backups and weekly snapshots, and local-first sync that merges edits field by field.

## Tech

React + TypeScript + Vite PWA · Tailwind · Dexie (IndexedDB) · Supabase (auth, sync, edge functions, cron) · ts-fsrs · rrule · chrono-node · Framer Motion. Everything runs on free tiers. See **[SETUP.md](SETUP.md)**.

```bash
npm install && npm run dev
npm test        # 94 unit tests
npm run e2e     # Playwright: persistence + core flows on phone & desktop
```
