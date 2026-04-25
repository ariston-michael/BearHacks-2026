import { useCallback, useRef } from 'react'
import { GestureName, Landmark } from '../types'
import { mapHandToCursor } from '../lib/cursorMapper'
import { Vector2Smoother } from '../lib/smoothing'

const SMOOTHING = 0.35
const SENSITIVITY = 1.5
// Skip cursor updates smaller than this many pixels to suppress hand tremor.
const DEAD_ZONE_PX = 4

export function useGestureControl(): {
  processFrame: (landmarks: Landmark[], gesture: GestureName) => void
} {
  const smoother = useRef(new Vector2Smoother(SMOOTHING))
  const pinchHeld = useRef(false)
  const lastPos = useRef({ x: -1, y: -1 })

  const processFrame = useCallback((landmarks: Landmark[], gesture: GestureName): void => {
    const W = window.screen.width
    const H = window.screen.height

    if (gesture === 'open-palm' || gesture === 'point') {
      pinchHeld.current = false

      const tip = landmarks[8] // index fingertip
      const mapped = mapHandToCursor(tip, W, H, SENSITIVITY)
      const smoothed = smoother.current.update(mapped)

      // Dead zone: suppress updates when movement is below threshold.
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
      // Hold: no further clicks until pinch is released.
    } else if (gesture === 'fist') {
      // Pause: freeze cursor, allow pinch to reset naturally on next open gesture.
      pinchHeld.current = false
    } else {
      pinchHeld.current = false
    }
  }, [])

  return { processFrame }
}
