import { useCallback, useEffect, useRef, useState } from 'react'
import { GestureName, Landmark } from '../types'
import { Vector2Smoother } from '../lib/smoothing'
import { useSettingsStore } from '../stores/settingsStore'
import type { CalibrationBounds } from '../stores/settingsStore'

const ACTIVE_MIN = 0.15
const ACTIVE_RANGE = 0.70
const DEAD_ZONE_PX = 4
const SMOOTHING = 0.3

const DEVIL_HORNS_COOLDOWN_MS = 120

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function deltaScale(distFromCenter: number): number {
  if (distFromCenter < 0.15) return 0.7
  if (distFromCenter > 0.35) return 1.3
  const t = (distFromCenter - 0.15) / 0.20
  return 0.7 + t * 0.6
}

function tipDist(lm: Landmark[]): number {
  return Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y)
}

export function useGestureControl(): {
  processFrame: (landmarks: Landmark[], gesture: GestureName, leftHandGesture: GestureName) => void
  isPrecisionMode: boolean
} {
  const smoother = useRef(new Vector2Smoother(SMOOTHING))
  const clickHeld = useRef(false)
  const clickCooldownUntil = useRef(0)
  const lastPos = useRef({ x: -1, y: -1 })
  const [isPrecisionMode, setIsPrecisionMode] = useState(false)
  const precisionRef = useRef(false)
  const displaySizeRef = useRef({
    width: Math.max(1, Math.round(window.screen.width * (window.devicePixelRatio || 1))),
    height: Math.max(1, Math.round(window.screen.height * (window.devicePixelRatio || 1)))
  })

  // Keep calibration bounds in a ref so the stable processFrame callback always reads the latest value.
  const calibBoundsRef = useRef<CalibrationBounds | null>(null)
  const calibrationBounds = useSettingsStore((s) => s.calibrationBounds)
  useEffect(() => { calibBoundsRef.current = calibrationBounds }, [calibrationBounds])

  useEffect(() => {
    const refreshDisplayMetrics = async (): Promise<void> => {
      try {
        const metrics = await window.electron.display.getActiveMetrics()
        displaySizeRef.current = {
          width: Math.max(1, Math.round(metrics.width * metrics.scaleFactor)),
          height: Math.max(1, Math.round(metrics.height * metrics.scaleFactor))
        }
      } catch {
        displaySizeRef.current = {
          width: Math.max(1, Math.round(window.screen.width * (window.devicePixelRatio || 1))),
          height: Math.max(1, Math.round(window.screen.height * (window.devicePixelRatio || 1)))
        }
      }
    }

    void refreshDisplayMetrics()
    const id = window.setInterval(() => {
      void refreshDisplayMetrics()
    }, 2000)

    return () => window.clearInterval(id)
  }, [])

  const processFrame = useCallback(
    (landmarks: Landmark[], gesture: GestureName, leftHandGesture: GestureName): void => {
      const W = displaySizeRef.current.width
      const H = displaySizeRef.current.height

      // Update precision mode UI only on transitions.
      const precision = leftHandGesture === 'open-palm'
      if (precision !== precisionRef.current) {
        precisionRef.current = precision
        setIsPrecisionMode(precision)
      }

      // 0.4× speed when left palm is open, normal speed otherwise.
      const speedMultiplier = precision ? 0.4 : 1.0

      const moveCursor = (tip: Landmark): void => {
        const calib = calibBoundsRef.current
        let activeX: number
        let activeY: number
        if (calib) {
          // Use calibrated bounds: screenX = 1 - tip.x (mirrored), same as how bounds were captured.
          const screenX = 1 - tip.x
          const rangeX = Math.max(0.01, calib.maxX - calib.minX)
          const rangeY = Math.max(0.01, calib.maxY - calib.minY)
          activeX = clamp((screenX - calib.minX) / rangeX, 0, 1)
          activeY = clamp((tip.y - calib.minY) / rangeY, 0, 1)
        } else {
          activeX = clamp((1 - tip.x - ACTIVE_MIN) / ACTIVE_RANGE, 0, 1)
          activeY = clamp((tip.y - ACTIVE_MIN) / ACTIVE_RANGE, 0, 1)
        }
        const rawX = activeX * (W - 1)
        const rawY = activeY * (H - 1)

        const distFromCenter = Math.hypot(activeX - 0.5, activeY - 0.5)
        const accel = deltaScale(distFromCenter)

        let scaledX: number
        let scaledY: number
        if (lastPos.current.x < 0) {
          scaledX = rawX
          scaledY = rawY
        } else {
          const combined = accel * speedMultiplier
          scaledX = lastPos.current.x + (rawX - lastPos.current.x) * combined
          scaledY = lastPos.current.y + (rawY - lastPos.current.y) * combined
        }

        const smoothed = smoother.current.update({ x: scaledX, y: scaledY })

        const dx = Math.abs(smoothed.x - lastPos.current.x)
        const dy = Math.abs(smoothed.y - lastPos.current.y)
        if (lastPos.current.x >= 0 && dx < DEAD_ZONE_PX && dy < DEAD_ZONE_PX) return

        lastPos.current = smoothed
        window.electron.cursor.move(Math.round(smoothed.x), Math.round(smoothed.y))
      }

      // --- devil-horns click/hold gesture ---
      const now = Date.now()
      const isDevilHorns = gesture === 'devil-horns'

      if (!clickHeld.current && isDevilHorns && now >= clickCooldownUntil.current) {
        clickHeld.current = true
        window.electron.cursor.mouseDown()
      } else if (clickHeld.current && !isDevilHorns) {
        clickHeld.current = false
        clickCooldownUntil.current = now + DEVIL_HORNS_COOLDOWN_MS
        window.electron.cursor.mouseUp()
      }

      // Cursor moves for pointing/palm gestures, and while click is held.
      if (gesture === 'open-palm' || gesture === 'point') {
        moveCursor(landmarks[8])
      } else if (gesture === 'devil-horns' || clickHeld.current) {
        moveCursor(landmarks[8])
      } else if (gesture === 'fist') {
        // fist = intentional stop; release any stuck click-hold as safety.
        if (clickHeld.current) {
          clickHeld.current = false
          clickCooldownUntil.current = now + DEVIL_HORNS_COOLDOWN_MS
          window.electron.cursor.mouseUp()
        }
      }
    },
    [] // setIsPrecisionMode is stable; no other captured deps
  )

  return { processFrame, isPrecisionMode }
}
