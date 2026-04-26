// Guided calibration flow that maps the user's hand range-of-motion to screen coordinates.
// Walks through a series of 4 corner positions to collect wrist position extremes,
// then saves calibrationBounds to settingsStore.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hands, Results } from '@mediapipe/hands'
import { Camera } from '@mediapipe/camera_utils'
import { useSettingsStore } from '../stores/settingsStore'
import type { CalibrationBounds } from '../stores/settingsStore'

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240'
const SAMPLES_NEEDED = 30 // ~1 second at 30fps per corner

type Corner = { label: string; hint: string; icon: string }

const CORNERS: Corner[] = [
  { label: 'Top-Left', hint: 'Raise your hand to the TOP-LEFT of your comfortable range', icon: '↖' },
  { label: 'Top-Right', hint: 'Move your hand to the TOP-RIGHT of your comfortable range', icon: '↗' },
  { label: 'Bottom-Right', hint: 'Lower your hand to the BOTTOM-RIGHT', icon: '↘' },
  { label: 'Bottom-Left', hint: 'Move your hand to the BOTTOM-LEFT', icon: '↙' },
]

type Phase = 'intro' | 'countdown' | 'sampling' | 'done'

export default function CalibrationPage(): React.JSX.Element {
  const navigate = useNavigate()
  const setCalibrationBounds = useSettingsStore((s) => s.setCalibrationBounds)
  const existingBounds = useSettingsStore((s) => s.calibrationBounds)

  const videoRef = useRef<HTMLVideoElement>(null)
  const handsRef = useRef<Hands | null>(null)
  const cameraRef = useRef<Camera | null>(null)

  const [phase, setPhase] = useState<Phase>('intro')
  const [stepIndex, setStepIndex] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const [sampleCount, setSampleCount] = useState(0)
  const [wristPos, setWristPos] = useState<{ x: number; y: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Captured wrist positions per corner: we store the median x/y for robustness
  const cornersData = useRef<Array<{ x: number; y: number }>>([])
  const sampleBuffer = useRef<Array<{ x: number; y: number }>>([])
  const phaseRef = useRef<Phase>('intro')
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  phaseRef.current = phase

  // ── MediaPipe setup ──────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    try {
      const hands = new Hands({ locateFile: (f) => `${MEDIAPIPE_CDN}/${f}` })
      handsRef.current = hands
      hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 })

      hands.onResults((results: Results) => {
        const lms = results.multiHandLandmarks?.[0]
        if (!lms) { setWristPos(null); return }
        const wrist = lms[0]
        setWristPos({ x: wrist.x, y: wrist.y })
        if (phaseRef.current === 'sampling') {
          sampleBuffer.current.push({ x: wrist.x, y: wrist.y })
          setSampleCount(sampleBuffer.current.length)
        }
      })

      const camera = new Camera(video, {
        onFrame: async () => { await hands.send({ image: video }) },
        width: 640, height: 480,
      })
      cameraRef.current = camera
      await camera.start()
    } catch (e) {
      setError(`Camera error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [])

  useEffect(() => {
    startCamera()
    return () => {
      cameraRef.current?.stop()
      handsRef.current?.close()
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    }
  }, [startCamera])

  // ── Step logic ───────────────────────────────────────────────────────────
  const beginStep = useCallback((idx: number) => {
    sampleBuffer.current = []
    setSampleCount(0)
    setCountdown(3)
    setPhase('countdown')

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current!)
          setPhase('sampling')
          sampleBuffer.current = []
          setSampleCount(0)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    setStepIndex(idx)
  }, [])

  // Advance once we have enough samples
  useEffect(() => {
    if (phase !== 'sampling') return
    if (sampleCount < SAMPLES_NEEDED) return

    // Median x and y of buffer
    const xs = sampleBuffer.current.map((p) => p.x).sort((a, b) => a - b)
    const ys = sampleBuffer.current.map((p) => p.y).sort((a, b) => a - b)
    const mid = Math.floor(xs.length / 2)
    cornersData.current[stepIndex] = { x: xs[mid], y: ys[mid] }

    const nextIdx = stepIndex + 1
    if (nextIdx < CORNERS.length) {
      beginStep(nextIdx)
    } else {
      // All 4 corners captured — compute bounds
      const allX = cornersData.current.map((c) => 1 - c.x) // mirror for screen space
      const allY = cornersData.current.map((c) => c.y)
      const bounds: CalibrationBounds = {
        minX: Math.min(...allX),
        maxX: Math.max(...allX),
        minY: Math.min(...allY),
        maxY: Math.max(...allY),
      }
      setCalibrationBounds(bounds)
      cameraRef.current?.stop()
      setPhase('done')
    }
  }, [phase, sampleCount, stepIndex, beginStep, setCalibrationBounds])

  // ── Render ───────────────────────────────────────────────────────────────
  const currentCorner = CORNERS[stepIndex]
  const progress = (sampleCount / SAMPLES_NEEDED) * 100

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div>
        <p className="text-xs font-medium text-white/40 mb-1">AirControl › Calibration</p>
        <h1 className="text-2xl font-bold text-white">Gesture Calibration</h1>
        <p className="mt-1 text-sm text-white/50">
          Map your comfortable hand range to the full screen so the cursor reaches every corner without strain.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Persistent camera feed — always mounted so the Camera ref never detaches */}
      <div className={`rounded-xl overflow-hidden border border-white/10 bg-zinc-950 w-full aspect-video relative max-w-2xl ${phase === 'done' ? 'hidden' : ''}`}>
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
          playsInline
          muted
          autoPlay
        />

        {/* Corner target overlay — shown during countdown/sampling */}
        {(phase === 'countdown' || phase === 'sampling') && currentCorner && (
          <div className={`absolute inset-0 pointer-events-none ${
            currentCorner.label === 'Top-Left' ? 'flex items-start justify-start p-4' :
            currentCorner.label === 'Top-Right' ? 'flex items-start justify-end p-4' :
            currentCorner.label === 'Bottom-Right' ? 'flex items-end justify-end p-4' :
            'flex items-end justify-start p-4'
          }`}>
            <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-lg transition-all ${
              phase === 'sampling' && progress > 50
                ? 'border-emerald-400 text-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.5)]'
                : 'border-indigo-400 text-indigo-400 shadow-[0_0_16px_rgba(99,102,241,0.4)] animate-pulse'
            }`}>
              {currentCorner.icon}
            </div>
          </div>
        )}

        <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white/60">
          {wristPos ? `✓ Hand detected at (${(1 - wristPos.x).toFixed(2)}, ${wristPos.y.toFixed(2)})` : '⚠ No hand detected'}
        </div>
      </div>

      {/* Intro */}
      {phase === 'intro' && (
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-base font-semibold text-white mb-3">Before you start</h2>
            <ul className="space-y-2 text-sm text-white/60">
              <li className="flex gap-2"><span className="text-indigo-400">①</span> Sit in your normal position in front of the camera.</li>
              <li className="flex gap-2"><span className="text-indigo-400">②</span> You will be asked to hold your hand at 4 corners of your comfortable range.</li>
              <li className="flex gap-2"><span className="text-indigo-400">③</span> Hold each position for ~1 second while the bar fills.</li>
              <li className="flex gap-2"><span className="text-indigo-400">④</span> Calibration takes ~15 seconds total.</li>
            </ul>
            {existingBounds && (
              <p className="mt-4 text-[11px] text-zinc-500">
                Existing bounds will be overwritten: x [{existingBounds.minX.toFixed(2)}–{existingBounds.maxX.toFixed(2)}] · y [{existingBounds.minY.toFixed(2)}–{existingBounds.maxY.toFixed(2)}]
              </p>
            )}
          </div>

          <button
            onClick={() => beginStep(0)}
            className="self-start px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-900/40"
          >
            Start Calibration →
          </button>
        </div>
      )}

      {/* Countdown + Sampling */}
      {(phase === 'countdown' || phase === 'sampling') && (
        <div className="flex flex-col gap-4">
          {/* Corner indicator pills */}
          <div className="flex gap-2 flex-wrap">
            {CORNERS.map((c, i) => (
              <span key={i} className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                i < stepIndex ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30' :
                i === stepIndex ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50' :
                'bg-zinc-800 text-zinc-600'
              }`}>
                {c.icon} {c.label}
              </span>
            ))}
          </div>

          {/* Instruction banner */}
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-5 text-center">
            {phase === 'countdown' ? (
              <>
                <p className="text-sm text-indigo-300 mb-1">Get ready…</p>
                <p className="text-4xl font-mono font-bold text-white">{countdown}</p>
                <p className="text-sm text-white/50 mt-2">{currentCorner.hint}</p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-white mb-1">
                  {currentCorner.icon} Hold here — {currentCorner.label}
                </p>
                <p className="text-sm text-white/50 mb-4">{currentCorner.hint}</p>
                <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-indigo-400 transition-all duration-75"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-2">{sampleCount}/{SAMPLES_NEEDED} samples</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Done */}
      {phase === 'done' && (
        <div className="flex flex-col gap-5 max-w-2xl">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <div className="text-5xl mb-3">✓</div>
            <h2 className="text-xl font-bold text-white mb-2">Calibration Complete</h2>
            <p className="text-sm text-white/60 mb-4">
              Your hand range has been saved. The cursor will now map to the full screen within your comfortable movement area.
            </p>
            {existingBounds && (
              <div className="inline-block rounded-lg bg-black/30 px-4 py-2 font-mono text-xs text-zinc-400">
                x [{existingBounds.minX.toFixed(3)} – {existingBounds.maxX.toFixed(3)}] &nbsp;·&nbsp; y [{existingBounds.minY.toFixed(3)} – {existingBounds.maxY.toFixed(3)}]
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => { setPhase('intro'); setStepIndex(0); cornersData.current = []; startCamera() }}
              className="px-5 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:bg-white/5 transition-colors"
            >
              Recalibrate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
