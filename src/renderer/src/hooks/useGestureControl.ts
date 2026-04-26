import { useCallback, useRef, useState } from 'react'
import { GestureName, Landmark } from '../types'
import { Vector2Smoother } from '../lib/smoothing'

const ACTIVE_MIN = 0.15
const ACTIVE_RANGE = 0.70
const DEAD_ZONE_PX = 4
const SMOOTHING = 0.3

// Hysteresis thresholds for pinch (normalized tip-to-tip distance).
// Tighter to engage, looser to release — prevents jitter at the boundary.
const PINCH_ON_DIST  = 0.04
const PINCH_OFF_DIST = 0.06
const PINCH_COOLDOWN_MS = 200

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
  const pinchHeld = useRef(false)
  const pinchCooldownUntil = useRef(0)
  const lastPos = useRef({ x: -1, y: -1 })
  const [isPrecisionMode, setIsPrecisionMode] = useState(false)
  const precisionRef = useRef(false)

  const processFrame = useCallback(
    (landmarks: Landmark[], gesture: GestureName, leftHandGesture: GestureName): void => {
      const W = window.screen.width
      const H = window.screen.height

      // Update precision mode UI only on transitions.
      const precision = leftHandGesture === 'open-palm'
      if (precision !== precisionRef.current) {
        precisionRef.current = precision
        setIsPrecisionMode(precision)
      }

      // 0.4× speed when left palm is open, normal speed otherwise.
      const speedMultiplier = precision ? 0.4 : 1.0

      const moveCursor = (tip: Landmark): void => {
        const activeX = clamp((1 - tip.x - ACTIVE_MIN) / ACTIVE_RANGE, 0, 1)
        const activeY = clamp((tip.y - ACTIVE_MIN) / ACTIVE_RANGE, 0, 1)
        const rawX = activeX * W
        const rawY = activeY * H

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

      // --- hysteresis pinch detection on raw landmark distance ---
      const rawDist = tipDist(landmarks)
      const now = Date.now()

      if (!pinchHeld.current && rawDist < PINCH_ON_DIST && now >= pinchCooldownUntil.current) {
        pinchHeld.current = true
        window.electron.cursor.mouseDown()
      } else if (pinchHeld.current && rawDist > PINCH_OFF_DIST) {
        pinchHeld.current = false
        pinchCooldownUntil.current = now + PINCH_COOLDOWN_MS
        window.electron.cursor.mouseUp()
      }

      // Cursor moves for pointing/palm gestures, and while pinch is held.
      if (gesture === 'open-palm' || gesture === 'point') {
        moveCursor(landmarks[8])
      } else if (pinchHeld.current) {
        moveCursor(landmarks[8])
      } else if (gesture === 'fist') {
        // fist = intentional stop; release any stuck pinch as safety.
        if (pinchHeld.current) {
          pinchHeld.current = false
          pinchCooldownUntil.current = now + PINCH_COOLDOWN_MS
          window.electron.cursor.mouseUp()
        }
      }
    },
    [] // setIsPrecisionMode is stable; no other captured deps
  )

  return { processFrame, isPrecisionMode }
}
