import { useCallback, useRef } from 'react'
import { GestureName, Landmark } from '../types'
import { Vector2Smoother } from '../lib/smoothing'

// Comfortable active region — user doesn't need to reach frame edges.
// Landmarks outside this range clamp to screen edges.
const ACTIVE_MIN = 0.15
const ACTIVE_RANGE = 0.70 // covers [0.15 .. 0.85]

// Suppress updates smaller than this to kill hand tremor.
const DEAD_ZONE_PX = 4

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

// Scale applied to the per-frame cursor delta.
// < 0.15 from center → 0.7× (slow, precise)
// > 0.35 from center → 1.3× (fast, full coverage)
// Linear interpolation between the two thresholds.
function deltaScale(distFromCenter: number): number {
  if (distFromCenter < 0.15) return 0.7
  if (distFromCenter > 0.35) return 1.3
  const t = (distFromCenter - 0.15) / 0.20
  return 0.7 + t * 0.6
}

export function useGestureControl(): {
  processFrame: (landmarks: Landmark[], gesture: GestureName) => void
} {
  // smoothingFactor 0.4  →  smoothed = prev * 0.6 + raw * 0.4
  const smoother = useRef(new Vector2Smoother(0.4))
  const pinchHeld = useRef(false)
  const lastPos = useRef({ x: -1, y: -1 })

  const processFrame = useCallback((landmarks: Landmark[], gesture: GestureName): void => {
    const W = window.screen.width
    const H = window.screen.height

    if (gesture === 'open-palm' || gesture === 'point') {
      pinchHeld.current = false

      const tip = landmarks[8] // index fingertip

      // 1. Active-region mapping. Invert x to match CSS scaleX(-1) mirror.
      //    When hand moves to user's right, tip.x decreases (camera's left),
      //    so (1 - tip.x) increases → cursor moves right. Correct.
      const activeX = clamp((1 - tip.x - ACTIVE_MIN) / ACTIVE_RANGE, 0, 1)
      const activeY = clamp((tip.y - ACTIVE_MIN) / ACTIVE_RANGE, 0, 1)
      const rawX = activeX * W
      const rawY = activeY * H

      // 2. Precision / speed acceleration on the cursor delta this frame.
      const distFromCenter = Math.hypot(activeX - 0.5, activeY - 0.5)
      const scale = deltaScale(distFromCenter)

      let scaledX: number
      let scaledY: number
      if (lastPos.current.x < 0) {
        // First frame — no previous delta to scale.
        scaledX = rawX
        scaledY = rawY
      } else {
        scaledX = lastPos.current.x + (rawX - lastPos.current.x) * scale
        scaledY = lastPos.current.y + (rawY - lastPos.current.y) * scale
      }

      // 3. Exponential smoothing on screen-space coordinates.
      const smoothed = smoother.current.update({ x: scaledX, y: scaledY })

      // 4. Dead zone: ignore sub-pixel jitter.
      const dx = Math.abs(smoothed.x - lastPos.current.x)
      const dy = Math.abs(smoothed.y - lastPos.current.y)
      if (lastPos.current.x >= 0 && dx < DEAD_ZONE_PX && dy < DEAD_ZONE_PX) return

      lastPos.current = smoothed
      window.electron.cursor.move(Math.round(smoothed.x), Math.round(smoothed.y))
    } else if (gesture === 'pinch') {
      if (!pinchHeld.current) {
        pinchHeld.current = true
        window.electron.cursor.click()
      }
      // Held: no further clicks until pinch is released.
    } else if (gesture === 'fist') {
      // Pause: freeze cursor position.
      pinchHeld.current = false
    } else {
      pinchHeld.current = false
    }
  }, [])

  return { processFrame }
}
