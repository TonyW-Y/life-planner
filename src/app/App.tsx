import { lazy, useEffect } from 'react'
import { startLifecycle } from '../lib/lifecycle'
import { startSync } from '../features/sync/engine'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { useSetting, type ThemeName } from '../lib/useSetting'
import { JoeyDecor } from '../themes/JoeyDecor'
import { Layout } from './Layout'
import { HomePage } from './pages/HomePage'

// pages load on demand so the app opens fast on a phone
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })))
const TasksPage = lazy(() => import('./pages/TasksPage').then((m) => ({ default: m.TasksPage })))
const StudyPage = lazy(() => import('./pages/StudyPage').then((m) => ({ default: m.StudyPage })))
const BudgetPage = lazy(() => import('./pages/BudgetPage').then((m) => ({ default: m.BudgetPage })))
const TTPage = lazy(() => import('./pages/TTPage').then((m) => ({ default: m.TTPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

const systemTheme = (): ThemeName =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

const THEME_COLOR: Record<ThemeName, string> = {
  light: '#fff8f1',
  dark: '#22201f',
  brown: '#f5e9dc',
  joey: '#fff0f5',
}

export function App() {
  const [theme] = useSetting<ThemeName>('theme', systemTheme())

  useEffect(() => {
    startLifecycle()
    void startSync()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
  }, [theme])

  return (
    <BrowserRouter>
      {theme === 'joey' && <JoeyDecor />}
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="calendar/*" element={<CalendarPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="study/*" element={<StudyPage />} />
          <Route path="budget" element={<BudgetPage />} />
          <Route path="tt" element={<TTPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
