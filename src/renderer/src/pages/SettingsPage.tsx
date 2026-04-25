import { useState, useEffect, useRef, useCallback } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import CameraView from '../components/CameraView'
import { NormalizedLandmark } from '@mediapipe/hands'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CameraDevice {
  deviceId: string
  label: string
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ label, description }: { label: string; description?: string }) {
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

function SettingsCard({ children }: { children: React.ReactNode }) {
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

function StyledSlider({
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
  leftLabel,
  rightLabel,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="mt-3">
      {/* Track */}
      <div className="relative h-1.5 rounded-full bg-zinc-800 mb-3">
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-indigo-500 transition-all"
          style={{ width: `${pct}%` }}
        />
        {/* Thumb hitbox overlay — real range input, invisible */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          style={{ zIndex: 2 }}
        />
        {/* Visual thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-indigo-500 shadow-md shadow-indigo-900/40 transition-all pointer-events-none"
          style={{ left: `${pct}%`, zIndex: 1 }}
        />
      </div>

      {/* Labels row */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-600">{leftLabel}</span>
        <span className="text-sm font-mono font-medium text-indigo-300 tabular-nums">
          {formatValue(value)}
        </span>
        <span className="text-[11px] text-zinc-600">{rightLabel}</span>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [sensitivity, setSensitivity] = useState(1.0)
  const [clickDelay, setClickDelay] = useState(100)
  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [audios, setAudios] = useState<CameraDevice[]>([])
  const selectedCameraId = useSettingsStore((state) => state.selectedCameraId)
  const setSelectedCameraId = useSettingsStore((state) => state.setSelectedCameraId)
  const selectedAudioId = useSettingsStore((state) => state.selectedAudioId)
  const setSelectedAudioId = useSettingsStore((state) => state.setSelectedAudioId)
  const selectedCameraLabel = cameras.find((cam) => cam.deviceId === selectedCameraId)?.label
  const selectedAudioLabel = audios.find((aud) => aud.deviceId === selectedAudioId)?.label
  const [screenResolution, setScreenResolution] = useState<{ width: number; height: number } | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const isCalibrating = useSettingsStore((state) => state.isCalibrating)
  const setIsCalibrating = useSettingsStore((state) => state.setIsCalibrating)
  const setCalibrationBounds = useSettingsStore((state) => state.setCalibrationBounds)
  const [mediaLoading, setMediaLoading] = useState(true)
  const calibrationPoints = useRef<{x: number, y: number}[]>([])
  const [calibrationCountdown, setCalibrationCountdown] = useState(5)
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Media enumeration ─────────────────────────────────────────────────────
  const loadMediaDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((s) =>
        s.getTracks().forEach((t) => t.stop())
      )
      const devices = await navigator.mediaDevices.enumerateDevices()
      
      const videoInputs = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: (d.label || `Camera ${i + 1}`).replace(/\s*\([^)]+\)\s*$/, '').trim(),
        }))

      const audioInputs = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: (d.label || `Microphone ${i + 1}`).replace(/\s*\([^)]+\)\s*$/, '').trim(),
        }))

      setCameras(videoInputs)
      setAudios(audioInputs)
      
      if (videoInputs.length > 0) {
        const hasSelected = videoInputs.some((cam) => cam.deviceId === selectedCameraId)
        if (!selectedCameraId || !hasSelected) {
          setSelectedCameraId(videoInputs[0].deviceId)
        }
      }
      
      if (audioInputs.length > 0) {
        const hasSelected = audioInputs.some((aud) => aud.deviceId === selectedAudioId)
        if (!selectedAudioId || !hasSelected) {
          setSelectedAudioId(audioInputs[0].deviceId)
        }
      }
    } catch {
      setCameras([])
      setAudios([])
    } finally {
      setMediaLoading(false)
    }
  }, [selectedCameraId, setSelectedCameraId, selectedAudioId, setSelectedAudioId])

  useEffect(() => {
    loadMediaDevices()
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current)
    }
  }, [loadMediaDevices])

  useEffect(() => {
    const updateResolution = () => {
      setScreenResolution({ width: window.screen.width, height: window.screen.height })
    }

    updateResolution()
    window.addEventListener('resize', updateResolution)
    return () => {
      window.removeEventListener('resize', updateResolution)
    }
  }, [])

  function handleRefreshMedia() {
    setMediaLoading(true)
    loadMediaDevices()
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleRecalibrate() {
    setIsCalibrating(true)
    setCalibrationCountdown(5)
    calibrationPoints.current = []

    if (countdownTimer.current) clearInterval(countdownTimer.current)
    countdownTimer.current = setInterval(() => {
      setCalibrationCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimer.current!)
          setIsCalibrating(false)
          
          const pts = calibrationPoints.current
          if (pts.length > 0) {
            const minX = Math.min(...pts.map(p => p.x))
            const maxX = Math.max(...pts.map(p => p.x))
            const minY = Math.min(...pts.map(p => p.y))
            const maxY = Math.max(...pts.map(p => p.y))
            // Only update if range is somewhat valid (not just a single point)
            if (maxX - minX > 0.05 && maxY - minY > 0.05) {
              setCalibrationBounds({ minX, maxX, minY, maxY })
            }
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto bg-zinc-950 text-white">
      {/* ── Page header ── */}
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-800/60 px-8 py-5">
        <div className="flex items-center justify-between max-w-2xl">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Settings</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Gesture sensitivity, hardware & calibration</p>
          </div>
          {/* Live status pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300 ${
              isPaused
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
              }`}
            />
            {isPaused ? 'Paused' : 'Active'}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-8 py-6 max-w-2xl space-y-8">

        {/* ── 1. Sensitivity ── */}
        <section>
          <SectionHeader
            label="Sensitivity"
            description="Controls how far your cursor travels relative to hand movement."
          />
          <SettingsCard>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-zinc-300 font-medium">Cursor Speed</span>
              <span className="text-[11px] text-zinc-600 font-mono">
                default 1.0×
              </span>
            </div>
            <StyledSlider
              value={sensitivity}
              min={0.5}
              max={2.0}
              step={0.05}
              onChange={setSensitivity}
              formatValue={(v) => `${v.toFixed(2)}×`}
              leftLabel="0.5× Slow"
              rightLabel="2.0× Fast"
            />
          </SettingsCard>
        </section>

        {/* ── 2. Click Confirmation Delay ── */}
        <section>
          <SectionHeader
            label="Click Confirmation Delay"
            description="How long you must hold the pinch gesture before a click registers. Higher = fewer accidental clicks."
          />
          <SettingsCard>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-zinc-300 font-medium">Hold Duration</span>
              <span className="text-[11px] text-zinc-600 font-mono">
                default 100ms
              </span>
            </div>
            <StyledSlider
              value={clickDelay}
              min={0}
              max={500}
              step={10}
              onChange={setClickDelay}
              formatValue={(v) => `${v}ms`}
              leftLabel="0ms Instant"
              rightLabel="500ms Deliberate"
            />
            {clickDelay === 0 && (
              <p className="mt-3 text-[11px] text-amber-400/80 flex items-center gap-1.5">
                <span>⚠</span> Instant clicks may trigger accidental actions.
              </p>
            )}
          </SettingsCard>
        </section>

        {/* ── 3. Media Devices ── */}
        <section>
          <SectionHeader
            label="Media Devices"
            description="Select the hardware used for gesture and voice detection. Hardware IDs are hidden for a cleaner look."
          />
          
          <SettingsCard>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-300 font-medium">Camera</span>
              <div className="flex items-center gap-2">
                {mediaLoading ? (
                  <span className="text-[11px] text-zinc-600 animate-pulse">Detecting…</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleRefreshMedia}
                    className="text-[11px] text-indigo-300 hover:text-white transition-colors"
                  >
                    Refresh
                  </button>
                )}
              </div>
            </div>

            {!mediaLoading && cameras.length === 0 ? (
              <div className="flex items-center gap-2 text-zinc-500 text-sm py-1">
                <span className="text-red-400">✕</span>
                No cameras found — check browser permissions.
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  disabled={mediaLoading}
                  className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white pr-9 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 transition-all disabled:opacity-40 cursor-pointer"
                >
                  {cameras.map((cam) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            )}

            {cameras.length > 0 && (
              <p className="mt-2 text-[11px] text-zinc-600">
                {cameras.length} device{cameras.length !== 1 ? 's' : ''} found
                {selectedCameraLabel ? ` · Active: ${selectedCameraLabel}` : ''}
              </p>
            )}
          </SettingsCard>

          <SettingsCard>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-300 font-medium">Microphone</span>
            </div>

            {!mediaLoading && audios.length === 0 ? (
              <div className="flex items-center gap-2 text-zinc-500 text-sm py-1">
                <span className="text-amber-400">⚠</span>
                No audio inputs found — check browser permissions.
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedAudioId}
                  onChange={(e) => setSelectedAudioId(e.target.value)}
                  disabled={mediaLoading}
                  className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white pr-9 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 transition-all disabled:opacity-40 cursor-pointer"
                >
                  {audios.map((aud) => (
                    <option key={aud.deviceId} value={aud.deviceId}>
                      {aud.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            )}

            {audios.length > 0 && (
              <p className="mt-2 text-[11px] text-zinc-600">
                {audios.length} device{audios.length !== 1 ? 's' : ''} found
                {selectedAudioLabel ? ` · Active: ${selectedAudioLabel}` : ''}
              </p>
            )}
          </SettingsCard>
        </section>

        {/* ── 4. Calibration ── */}
        <section>
          <SectionHeader
            label="Calibration"
            description={`Map your natural hand range to the full screen area. Current screen resolution: ${screenResolution?.width ?? '-'}×${screenResolution?.height ?? '-'}.`}
          />
          <SettingsCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-300 font-medium">Recalibrate Gesture Range</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  Run if cursor feels off or you've changed your setup.
                </p>
              </div>
              <button
                onClick={handleRecalibrate}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200 overflow-hidden ${
                  isCalibrating
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-indigo-600/20 hover:border-indigo-500/50 hover:text-indigo-300'
                }`}
              >
                {isCalibrating ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-spin">
                      <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.5" strokeDasharray="8 6"/>
                    </svg>
                    Calibrating...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3.05 3.05l1.42 1.42M9.54 9.54l1.41 1.41M9.54 4.46L10.95 3.05M3.05 10.95l1.42-1.41" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    Recalibrate for current display
                  </>
                )}
              </button>
            </div>
          </SettingsCard>
        </section>

        {/* ── 5. Pause / Resume ── */}
        <section>
          <SectionHeader
            label="Detection"
            description="Temporarily pause gesture recognition — useful when you need to type normally."
          />
          <SettingsCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-300 font-medium">
                  Gesture Detection
                </p>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  Also toggleable via <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] font-mono">F9</kbd> from any app
                </p>
              </div>

              {/* Toggle switch */}
              <button
                onClick={() => setIsPaused((p) => !p)}
                className={`relative flex items-center w-12 h-6 rounded-full border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                  isPaused
                    ? 'bg-zinc-800 border-zinc-700'
                    : 'bg-indigo-600 border-indigo-500'
                }`}
                role="switch"
                aria-checked={!isPaused}
              >
                <span
                  className={`absolute w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${
                    isPaused ? 'left-1' : 'left-7'
                  }`}
                />
              </button>
            </div>

            {/* State label */}
            <div
              className={`mt-4 flex items-center gap-2 text-xs transition-all duration-300 ${
                isPaused ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
                }`}
              />
              {isPaused
                ? 'Detection paused — gestures will not trigger actions'
                : 'Detection active — gestures are being processed'}
            </div>
          </SettingsCard>
        </section>

        {/* ── Bottom spacer ── */}
        <div className="h-6" />
      </div>

      {/* ── Calibration Overlay ── */}
      {isCalibrating && (
        <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-white mb-3">Calibration in Progress</h2>
            <p className="text-xl text-indigo-400 mb-2">
              Move your hand to all 4 corners of your screen.
            </p>
            <p className="text-3xl font-mono text-emerald-400 font-bold mt-6">
              {calibrationCountdown}s
            </p>
          </div>
          <div className="w-[640px] h-[480px] rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(99,102,241,0.2)] border-2 border-indigo-500/30">
            <CameraView 
              onLandmarks={(lms: NormalizedLandmark[]) => {
                // Use index 9 (middle finger MCP) as a stable center point for the hand
                if (lms && lms[9]) {
                  calibrationPoints.current.push({ x: lms[9].x, y: lms[9].y })
                }
              }} 
            />
          </div>
          <button
            onClick={() => {
              setIsCalibrating(false)
              if (countdownTimer.current) clearInterval(countdownTimer.current)
            }}
            className="mt-8 px-6 py-2 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
          >
            Cancel Calibration
          </button>
        </div>
      )}
    </div>
  )
}
