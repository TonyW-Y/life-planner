import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { TimerPage } from '../../features/study/timers/TimerPage'
import { ExamPlanPage } from '../../features/study/planner/ExamPlanPage'
import { StatsPage } from '../../features/study/stats/StatsPage'
import { FlashcardsPage } from '../../features/study/flashcards/FlashcardsPage'

const TABS = [
  { to: 'timer', label: 'Timer', emoji: '⏱️' },
  { to: 'cards', label: 'Flashcards', emoji: '🃏' },
  { to: 'plan', label: 'Exam plan', emoji: '🗺️' },
  { to: 'stats', label: 'Progress', emoji: '🌱' },
]

export function StudyPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">Study 📚</h1>
      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
        {TABS.map((t) => (
          <NavLink key={t.to} to={`/study/${t.to}`} className={({ isActive }) => `chip shrink-0 !min-h-11 !px-4 ${isActive ? 'chip-on' : ''}`}>
            {t.emoji} {t.label}
          </NavLink>
        ))}
      </div>
      <Routes>
        <Route index element={<Navigate to="timer" replace />} />
        <Route path="timer" element={<TimerPage />} />
        <Route path="cards/*" element={<FlashcardsPage />} />
        <Route path="plan" element={<ExamPlanPage />} />
        <Route path="stats" element={<StatsPage />} />
      </Routes>
    </div>
  )
}
