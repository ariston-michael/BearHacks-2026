import { useState, useEffect, useRef } from 'react'

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
  const [selectedCamera, setSelectedCamera] = useState<string>('')
  const [isPaused, setIsPaused] = useState(false)
  const [calibrateFlash, setCalibrateFlash] = useState(false)
  const [camerasLoading, setCamerasLoading] = useState(true)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Camera enumeration ─────────────────────────────────────────────────────
  useEffect(() => {
    async function loadCameras() {
      try {
        // Trigger permission prompt so labels are populated
        await navigator.mediaDevices.getUserMedia({ video: true }).then((s) =>
          s.getTracks().forEach((t) => t.stop())
        )
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoInputs = devices
          .filter((d) => d.kind === 'videoinput')
          .map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${i + 1}`,
          }))
        setCameras(videoInputs)
        if (videoInputs.length > 0 && !selectedCamera) {
          setSelectedCamera(videoInputs[0].deviceId)
        }
      } catch {
        // Permission denied or no cameras
        setCameras([])
      } finally {
        setCamerasLoading(false)
      }
    }
    loadCameras()
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [])

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleRecalibrate() {
    setCalibrateFlash(true)
    flashTimer.current = setTimeout(() => setCalibrateFlash(false), 1200)
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

        {/* ── 3. Camera Selection ── */}
        <section>
          <SectionHeader
            label="Camera"
            description="Select the input device for hand detection. Your Pixel 6 via DroidCam will appear here."
          />
          <SettingsCard>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-300 font-medium">Input Device</span>
              {camerasLoading && (
                <span className="text-[11px] text-zinc-600 animate-pulse">Detecting…</span>
              )}
            </div>

            {!camerasLoading && cameras.length === 0 ? (
              <div className="flex items-center gap-2 text-zinc-500 text-sm py-1">
                <span className="text-red-400">✕</span>
                No cameras found — check browser permissions.
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  disabled={camerasLoading}
                  className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white pr-9 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 transition-all disabled:opacity-40 cursor-pointer"
                >
                  {cameras.map((cam) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label}
                    </option>
                  ))}
                </select>
                {/* Chevron icon */}
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
              </p>
            )}
          </SettingsCard>
        </section>

        {/* ── 4. Calibration ── */}
        <section>
          <SectionHeader
            label="Calibration"
            description="Map your natural hand range to the full screen area. Takes about 30 seconds."
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
                  calibrateFlash
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-indigo-600/20 hover:border-indigo-500/50 hover:text-indigo-300'
                }`}
              >
                {calibrateFlash ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-spin">
                      <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.5" strokeDasharray="8 6"/>
                    </svg>
                    Starting…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3.05 3.05l1.42 1.42M9.54 9.54l1.41 1.41M9.54 4.46L10.95 3.05M3.05 10.95l1.42-1.41" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    Recalibrate
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
    </div>
  )
}
