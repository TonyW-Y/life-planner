import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PomPals } from '../features/pups/PomPals'
import { useSetting } from '../lib/useSetting'
import { Toaster } from './Toaster'

const NAV = [
  { to: '/', label: 'Home', icon: '🏡' },
  { to: '/calendar', label: 'Calendar', icon: '📅' },
  { to: '/tasks', label: 'To-do', icon: '✅' },
  { to: '/study', label: 'Study', icon: '📚' },
  { to: '/budget', label: 'My Time', icon: '⏳' },
  { to: '/tt', label: 'TT', icon: '🧸' },
]

export function Layout() {
  const loc = useLocation()
  const [showPups] = useSetting('showPups', true)
  const pupsOnPage = loc.pathname === '/' || loc.pathname.startsWith('/study/timer')
  return (
    <div className="relative z-10 flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-line bg-surface/70 p-4 backdrop-blur md:flex">
        <div className="mb-4 flex items-center gap-2 px-2 text-xl font-extrabold">
          <img src="/icon.svg" alt="" className="h-9 w-9" /> Cozy Planner
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-2xl px-3 font-bold transition ${isActive ? 'bg-primary-soft' : 'hover:bg-surface-2'}`
            }
          >
            <span className="text-xl">{n.icon}</span> {n.label}
          </NavLink>
        ))}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `mt-auto flex min-h-11 items-center gap-3 rounded-2xl px-3 font-bold ${isActive ? 'bg-primary-soft' : 'hover:bg-surface-2'}`
          }
        >
          <span className="text-xl">⚙️</span> Settings
        </NavLink>
        <p className="px-3 text-xs text-muted">Tip: press ⌘K to search or add anything</p>
      </aside>

      <main className="min-w-0 flex-1 pb-28 md:pb-8">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-bg/80 px-4 pb-2 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur md:hidden">
          <div className="flex items-center gap-2 text-lg font-extrabold">
            <img src="/icon.svg" alt="" className="h-8 w-8" /> Cozy
          </div>
          <div className="flex">
            <button className="icon-btn" aria-label="Search" onClick={() => window.dispatchEvent(new Event('cozy:command'))}>
              🔍
            </button>
            <NavLink to="/settings" className="icon-btn" aria-label="Settings">
              ⚙️
            </NavLink>
          </div>
        </header>
        <motion.div
          key={loc.pathname.split('/')[1]}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mx-auto max-w-6xl px-4 py-4 md:px-8 md:py-8"
        >
          <Outlet />
        </motion.div>
      </main>

      {/* corner pups on other pages */}
      {showPups && !pupsOnPage && (
        <div className="fixed bottom-24 right-2 z-20 md:bottom-4 md:right-4">
          <PomPals size={80} compact speech={false} />
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg justify-around px-1 pt-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex min-h-14 min-w-12 flex-col items-center justify-center rounded-2xl px-1 text-[11px] font-bold transition ${isActive ? 'bg-primary-soft' : 'text-muted'}`
              }
            >
              <span className="text-xl leading-6">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Toaster />
    </div>
  )
}
