import { useCallback, useEffect, useRef } from 'react'
import { GestureName, Landmark } from '../types'
import { useLeftHandStore } from '../stores/leftHandStore'

// Normalized-coordinate displacement from anchor before scroll fires.
const SCROLL_THRESHOLD = 0.05
// Scales displacement (after deadzone) to nut-js scroll units per frame.
const SCROLL_MULTIPLIER = 50
// Degrees of 3D rotation per normalized unit of hand movement (internal cube).
const ROT_SCALE = 200
// Left-hand active zone — matches right-hand mapping so drag feels 1:1 with screen.
const ACTIVE_MIN = 0.15
const ACTIVE_RANGE = 0.70

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Convert a normalized MediaPipe wrist coord to absolute screen pixels. */
function wristToScreen(wrist: Landmark): { x: number; y: number } {
  const W = window.screen.width
  const H = window.screen.height
  const sx = clamp((1 - wrist.x - ACTIVE_MIN) / ACTIVE_RANGE, 0, 1) * W
  const sy = clamp((wrist.y - ACTIVE_MIN) / ACTIVE_RANGE, 0, 1) * H
  return { x: Math.round(sx), y: Math.round(sy) }
}

export function useLeftHandControl(): {
  processLeftFrame: (landmarks: Landmark[] | null, gesture: GestureName) => void
} {
  // --- scroll loop state ---
  const scrollDirRef = useRef<'up' | 'down' | null>(null)
  const scrollSpeedRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const scrollAnchorY = useRef<number | null>(null)

  // --- MMB grab/drag state ---
  const grabActiveRef = useRef(false)   // true = middleDown already sent
  const prevPosRef = useRef<{ x: number; y: number } | null>(null)

  const setScrolling = useLeftHandStore((s) => s.setScrolling)
  const setGrabbing = useLeftHandStore((s) => s.setGrabbing)
  const setRotationDelta = useLeftHandStore((s) => s.setRotationDelta)

  // ----- scroll rAF loop -----
  const stopScrollLoop = useCallback((): void => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    scrollDirRef.current = null
    scrollSpeedRef.current = 0
    scrollAnchorY.current = null
    setScrolling(false, null)
  }, [setScrolling])

  const startScrollLoop = useCallback((): void => {
    if (rafRef.current !== null) return
    const loop = (): void => {
      const dir = scrollDirRef.current
      const speed = scrollSpeedRef.current
      if (dir && speed > 0) {
        window.electron.cursor.scroll(dir === 'down' ? speed : -speed)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  const releaseGrab = useCallback((): void => {
    if (grabActiveRef.current) {
      window.electron.cursor.middleUp()
      grabActiveRef.current = false
    }
    prevPosRef.current = null
  }, [])

  // Cleanup on unmount.
  useEffect(() => () => {
    stopScrollLoop()
    releaseGrab()
  }, [stopScrollLoop, releaseGrab])

  // ----- per-frame processor (called from CameraView) -----
  const processLeftFrame = useCallback(
    (landmarks: Landmark[] | null, gesture: GestureName): void => {
      if (!landmarks) {
        stopScrollLoop()
        releaseGrab()
        setGrabbing(false)
        setRotationDelta(0, 0)
        return
      }

      const wrist = landmarks[0]
      const isGrab = gesture === 'fist' || gesture === 'thumbs-up'

      if (gesture === 'v-shape') {
        // ----- proportional anchor-and-drag auto-scroll -----
        releaseGrab()

        if (scrollAnchorY.current === null) {
          scrollAnchorY.current = wrist.y
        }
        const displacement = wrist.y - scrollAnchorY.current
        const absDelta = Math.abs(displacement) - SCROLL_THRESHOLD

        if (displacement < -SCROLL_THRESHOLD) {
          scrollDirRef.current = 'up'
          scrollSpeedRef.current = Math.max(1, Math.round(absDelta * SCROLL_MULTIPLIER))
        } else if (displacement > SCROLL_THRESHOLD) {
          scrollDirRef.current = 'down'
          scrollSpeedRef.current = Math.max(1, Math.round(absDelta * SCROLL_MULTIPLIER))
        } else {
          scrollDirRef.current = null
          scrollSpeedRef.current = 0
        }
        setScrolling(true, scrollDirRef.current)
        startScrollLoop()
        setGrabbing(false)
        setRotationDelta(0, 0)

      } else if (isGrab) {
        // ----- universal MMB drag — works in Blender, Three.js, any OS app -----
        stopScrollLoop()
        setGrabbing(true)

        if (!grabActiveRef.current) {
          grabActiveRef.current = true
          window.electron.cursor.middleDown()
        }

        // Drive the cursor with the left wrist while MMB is held.
        // This makes the left hand a true joystick for 3D camera orbit.
        const screen = wristToScreen(wrist)
        window.electron.cursor.move(screen.x, screen.y)

        // Also publish deltas for the internal ModelViewer cube.
        const prev = prevPosRef.current
        prevPosRef.current = { x: wrist.x, y: wrist.y }
        if (prev) {
          setRotationDelta(
            (wrist.x - prev.x) * ROT_SCALE,
            (wrist.y - prev.y) * ROT_SCALE,
          )
        } else {
          setRotationDelta(0, 0)
        }

      } else {
        stopScrollLoop()
        releaseGrab()
        setGrabbing(false)
        setRotationDelta(0, 0)
      }
    },
    [stopScrollLoop, startScrollLoop, releaseGrab, setScrolling, setGrabbing, setRotationDelta],
  )

  return { processLeftFrame }
}
