// User-configurable settings: sensitivity, smoothing, gesture-to-action bindings,
// camera source, and toggle for individual gestures. Backed by settingsStore and electron-store.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettingsStore } from '../stores/settingsStore'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MediaDevice {
  deviceId: string
  label: string
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ label, description }: { label: string; description?: string }): React.JSX.Element {
  return (
    <div className="mb-4">
      <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-indigo-400 mb-0.5">
        {label}
      </h2>
      {description && (
        <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
      )}
    </div>
  )
}

function SettingsCard({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-3 transition-colors hover:border-zinc-700">
      {children}
    </div>
  )
}

interface SliderProps {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  formatValue: (v: number) => string
  leftLabel: string
  rightLabel: string
}

function StyledSlider({ value, min, max, step, onChange, formatValue, leftLabel, rightLabel }: SliderProps): React.JSX.Element {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="mt-3">
      <div className="relative h-1.5 rounded-full bg-zinc-800 mb-3">
        <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          style={{ zIndex: 2 }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-indigo-500 shadow-md shadow-indigo-900/40 transition-all pointer-events-none"
          style={{ left: `${pct}%`, zIndex: 1 }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-600">{leftLabel}</span>
        <span className="text-sm font-mono font-medium text-indigo-300 tabular-nums">{formatValue(value)}</span>
        <span className="text-[11px] text-zinc-600">{rightLabel}</span>
      </div>
    </div>
  )
}


// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage(): React.JSX.Element {
  const navigate = useNavigate()

  // ── Zustand state ──────────────────────────────────────────────────────────
  const sensitivity = useSettingsStore((s) => s.sensitivity)
  const setSensitivity = useSettingsStore((s) => s.setSensitivity)
  const scrollMultiplier = useSettingsStore((s) => s.scrollMultiplier)
  const setScrollMultiplier = useSettingsStore((s) => s.setScrollMultiplier)
  const selectedCameraId = useSettingsStore((s) => s.selectedCameraId)
  const setSelectedCameraId = useSettingsStore((s) => s.setSelectedCameraId)
  const selectedAudioId = useSettingsStore((s) => s.selectedAudioId)
  const setSelectedAudioId = useSettingsStore((s) => s.setSelectedAudioId)
  const calibrationBounds = useSettingsStore((s) => s.calibrationBounds)
  const launchOnStartup = useSettingsStore((s) => s.launchOnStartup)
  const setLaunchOnStartup = useSettingsStore((s) => s.setLaunchOnStartup)

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [cameras, setCameras] = useState<MediaDevice[]>([])
  const [audios, setAudios] = useState<MediaDevice[]>([])
  const [mediaLoading, setMediaLoading] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [clickDelay, setClickDelay] = useState(100) // visual only; engine uses hardcoded hysteresis

  // ── Load startup setting from main process ─────────────────────────────────
  useEffect(() => {
    window.electron.settings.getStartup().then((v) => setLaunchOnStartup(v))
  }, [setLaunchOnStartup])

  const handleStartupToggle = async (): Promise<void> => {
    const next = !launchOnStartup
    setLaunchOnStartup(next)
    await window.electron.settings.setStartup(next)
  }

  // ── Media enumeration ─────────────────────────────────────────────────────
  const loadMediaDevices = useCallback(async () => {
    setMediaLoading(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      stream.getTracks().forEach((t) => t.stop())
      const devices = await navigator.mediaDevices.enumerateDevices()

      const videoInputs = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: (d.label || `Camera ${i + 1}`).replace(/\s*\([^)]+\)\s*$/, '').trim() }))

      const audioInputs = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: (d.label || `Microphone ${i + 1}`).replace(/\s*\([^)]+\)\s*$/, '').trim() }))

      setCameras(videoInputs)
      setAudios(audioInputs)
      if (videoInputs.length > 0 && (!selectedCameraId || !videoInputs.find((c) => c.deviceId === selectedCameraId))) {
        setSelectedCameraId(videoInputs[0].deviceId)
      }
      if (audioInputs.length > 0 && (!selectedAudioId || !audioInputs.find((a) => a.deviceId === selectedAudioId))) {
        setSelectedAudioId(audioInputs[0].deviceId)
      }
    } catch {
      setCameras([])
      setAudios([])
    } finally {
      setMediaLoading(false)
    }
  }, [selectedCameraId, setSelectedCameraId, selectedAudioId, setSelectedAudioId])

  const loadedRef = useRef(false)
  useEffect(() => {
    if (!loadedRef.current) { loadedRef.current = true; loadMediaDevices() }
  }, [loadMediaDevices])

  const selectedCameraLabel = cameras.find((c) => c.deviceId === selectedCameraId)?.label
  const selectedAudioLabel = audios.find((a) => a.deviceId === selectedAudioId)?.label

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto bg-zinc-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-800/60 px-8 py-5">
        <div className="flex items-center justify-between max-w-2xl">
          <div>
            <p className="text-xs font-medium text-white/40 mb-0.5">AirFlow › Settings</p>
            <h1 className="text-xl font-semibold text-white tracking-tight">Settings</h1>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300 ${isPaused ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
            {isPaused ? 'Paused' : 'Active'}
          </div>
        </div>
      </div>

      <div className="px-8 py-6 max-w-2xl space-y-8">

        {/* ── 1. Gesture Tuning ── */}
        <section>
          <SectionHeader label="Gesture Tuning" description="Fine-tune cursor speed and scroll responsiveness." />

          <SettingsCard>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-zinc-300 font-medium">Cursor Speed</span>
              <span className="text-[11px] text-zinc-600 font-mono">default 1.0×</span>
            </div>
            <StyledSlider
              value={sensitivity} min={0.5} max={2.0} step={0.05}
              onChange={setSensitivity}
              formatValue={(v) => `${v.toFixed(2)}×`}
              leftLabel="0.5× Slow" rightLabel="2.0× Fast"
            />
          </SettingsCard>

          <SettingsCard>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-zinc-300 font-medium">Left-Hand Scroll Speed</span>
              <span className="text-[11px] text-zinc-600 font-mono">default 50</span>
            </div>
            <p className="text-[11px] text-zinc-600 mb-1">Multiplier applied to V-shape displacement. Higher = faster scroll.</p>
            <StyledSlider
              value={scrollMultiplier} min={10} max={150} step={5}
              onChange={setScrollMultiplier}
              formatValue={(v) => `${v}`}
              leftLabel="10 Slow" rightLabel="150 Fast"
            />
          </SettingsCard>

          <SettingsCard>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-zinc-300 font-medium">Click Confirmation Hold</span>
              <span className="text-[11px] text-zinc-600 font-mono">default 100ms</span>
            </div>
            <p className="text-[11px] text-zinc-600 mb-1">How long to hold pinch before a click fires. Higher = fewer accidental clicks.</p>
            <StyledSlider
              value={clickDelay} min={0} max={500} step={10}
              onChange={setClickDelay}
              formatValue={(v) => `${v}ms`}
              leftLabel="0ms Instant" rightLabel="500ms Deliberate"
            />
            {clickDelay === 0 && (
              <p className="mt-3 text-[11px] text-amber-400/80 flex items-center gap-1.5">
                <span>⚠</span> Instant clicks may fire accidentally.
              </p>
            )}
          </SettingsCard>
        </section>

        {/* ── 2. Media Devices ── */}
        <section>
          <SectionHeader label="Media Devices" description="Select the camera and microphone used for gesture and voice detection." />

          <SettingsCard>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-300 font-medium">Camera</span>
              <button onClick={loadMediaDevices} disabled={mediaLoading} className="text-[11px] text-indigo-300 hover:text-white transition-colors disabled:opacity-40">
                {mediaLoading ? 'Detecting…' : 'Refresh'}
              </button>
            </div>
            {!mediaLoading && cameras.length === 0 ? (
              <p className="text-sm text-zinc-500"><span className="text-red-400">✕</span> No cameras found — check permissions.</p>
            ) : (
              <div className="relative">
                <select value={selectedCameraId} onChange={(e) => setSelectedCameraId(e.target.value)} disabled={mediaLoading}
                  className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white pr-9 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 transition-all disabled:opacity-40 cursor-pointer">
                  {cameras.map((c) => <option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
            )}
            {cameras.length > 0 && <p className="mt-2 text-[11px] text-zinc-600">{cameras.length} device{cameras.length !== 1 ? 's' : ''} found{selectedCameraLabel ? ` · Active: ${selectedCameraLabel}` : ''}</p>}
          </SettingsCard>

          <SettingsCard>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-300 font-medium">Microphone</span>
            </div>
            {!mediaLoading && audios.length === 0 ? (
              <p className="text-sm text-zinc-500"><span className="text-amber-400">⚠</span> No microphones found — check permissions.</p>
            ) : (
              <div className="relative">
                <select value={selectedAudioId} onChange={(e) => setSelectedAudioId(e.target.value)} disabled={mediaLoading}
                  className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white pr-9 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 transition-all disabled:opacity-40 cursor-pointer">
                  {audios.map((a) => <option key={a.deviceId} value={a.deviceId}>{a.label}</option>)}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
            )}
            {audios.length > 0 && <p className="mt-2 text-[11px] text-zinc-600">{audios.length} device{audios.length !== 1 ? 's' : ''} found{selectedAudioLabel ? ` · Active: ${selectedAudioLabel}` : ''}</p>}
          </SettingsCard>
        </section>

        {/* ── 3. Calibration ── */}
        <section>
          <SectionHeader
            label="Calibration"
            description={`Map your hand's natural range-of-motion to the full screen. Saved bounds: ${
              calibrationBounds
                ? `x [${calibrationBounds.minX.toFixed(2)} – ${calibrationBounds.maxX.toFixed(2)}] · y [${calibrationBounds.minY.toFixed(2)} – ${calibrationBounds.maxY.toFixed(2)}]`
                : 'not set — using defaults'
            }`}
          />
          <SettingsCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-300 font-medium">Recalibrate Gesture Range</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">Run if cursor feels off or you've changed your seating position.</p>
              </div>
              <button
                onClick={() => navigate('/calibration')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-indigo-600/20 hover:border-indigo-500/50 hover:text-indigo-300 transition-all duration-200"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v2M7 11v2M1 7h2M11 7h2M3.05 3.05l1.42 1.42M9.54 9.54l1.41 1.41M9.54 4.46L10.95 3.05M3.05 10.95l1.42-1.41" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                Open Calibration Wizard
              </button>
            </div>
          </SettingsCard>
        </section>

        {/* ── 4. System Controls ── */}
        <section>
          <SectionHeader label="System" description="OS-level integration options." />

          <SettingsCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-300 font-medium">Launch on System Startup</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">AirFlow will start automatically when you log in.</p>
              </div>
              <button
                onClick={handleStartupToggle}
                className={`relative flex items-center w-12 h-6 rounded-full border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${launchOnStartup ? 'bg-indigo-600 border-indigo-500' : 'bg-zinc-800 border-zinc-700'}`}
                role="switch" aria-checked={launchOnStartup}
              >
                <span className={`absolute w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${launchOnStartup ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </SettingsCard>

          <SettingsCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-300 font-medium">Gesture Detection</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  Temporarily pause gesture recognition. Also toggleable via{' '}
                  <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] font-mono">F9</kbd>
                </p>
              </div>
              <button
                onClick={() => setIsPaused((p) => !p)}
                className={`relative flex items-center w-12 h-6 rounded-full border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isPaused ? 'bg-zinc-800 border-zinc-700' : 'bg-indigo-600 border-indigo-500'}`}
                role="switch" aria-checked={!isPaused}
              >
                <span className={`absolute w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${isPaused ? 'left-1' : 'left-7'}`} />
              </button>
            </div>
            <div className={`mt-4 flex items-center gap-2 text-xs transition-all duration-300 ${isPaused ? 'text-amber-400' : 'text-emerald-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
              {isPaused ? 'Detection paused — gestures will not trigger actions' : 'Detection active — gestures are being processed'}
            </div>
          </SettingsCard>
        </section>

        <div className="h-6" />
      </div>
    </div>
  )
}
