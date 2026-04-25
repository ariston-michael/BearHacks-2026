import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import CalibrationPage from './pages/CalibrationPage'
import SettingsPage from './pages/SettingsPage'
import TutorialPage from './pages/TutorialPage'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/calibration', label: 'Calibration' },
  { to: '/settings', label: 'Settings' },
  { to: '/tutorial', label: 'Tutorial' },
]

function Sidebar(): React.JSX.Element {
  return (
    <aside className="flex h-screen w-48 flex-col gap-1 bg-[#0a0a1a] p-4 border-r border-white/10">
      <div className="mb-6 text-lg font-bold text-accent tracking-wide">AirControl</div>
      {NAV_ITEMS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-accent text-white'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </aside>
  )
}

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <div className="dark flex h-screen w-screen overflow-hidden bg-[#0a0a1a] text-white">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/calibration" element={<CalibrationPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/tutorial" element={<TutorialPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

export default App
