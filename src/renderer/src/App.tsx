import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import CalibrationPage from './pages/CalibrationPage'
import SettingsPage from './pages/SettingsPage'
import TutorialPage from './pages/TutorialPage'
import VoiceSettingsPage from './pages/VoiceSettingsPage'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/calibration', label: 'Calibration' },
  { to: '/settings', label: 'Settings' },
  { to: '/voice', label: 'Voice' },
  { to: '/tutorial', label: 'Tutorial' }
]

function Sidebar(): React.JSX.Element {
  return (
    <aside className="flex h-screen w-48 flex-col gap-1 bg-[#0a0a1a] p-4 border-r border-white/10">
      <div className="mb-6 text-lg font-bold text-accent tracking-wide">AirFlow</div>
      {NAV_ITEMS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? 'bg-accent text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
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
        <main className="flex min-h-0 flex-1 flex-col overflow-auto p-8" data-voice-scroll-root>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/calibration" element={<CalibrationPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/voice" element={<VoiceSettingsPage />} />
            <Route path="/tutorial" element={<TutorialPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

export default App
