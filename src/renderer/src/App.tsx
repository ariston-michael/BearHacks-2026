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
    <aside className="relative z-10 flex h-screen w-48 flex-col gap-1 bg-white/[0.03] backdrop-blur-xl border-r border-white/[0.08] p-4 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]">
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
      <div className="dark flex h-screen w-screen overflow-hidden bg-[#07071a] text-white relative">
        {/* Background gradient orbs — give glass panels something to blur against */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
          <div className="absolute top-1/2 -right-56 w-[600px] h-[600px] rounded-full bg-violet-700/15 blur-[140px]" />
          <div className="absolute -bottom-56 left-1/3 w-[480px] h-[480px] rounded-full bg-indigo-900/25 blur-[120px]" />
        </div>
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
