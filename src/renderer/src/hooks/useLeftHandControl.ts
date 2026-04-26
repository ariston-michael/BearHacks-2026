import { useCallback, useEffect, useRef } from 'react'
import { GestureName, Landmark } from '../types'
import { useLeftHandStore } from '../stores/leftHandStore'

// Normalized-coordinate displacement from anchor before scroll fires.
const SCROLL_THRESHOLD = 0.05
// Scales displacement (after deadzone) to nut-js scroll units per frame.
// Higher = faster scroll the further the hand moves.
const SCROLL_MULTIPLIER = 50
// Degrees of 3D rotation per normalized unit of hand movement (internal cube).
const ROT_SCALE = 200

export function useLeftHandControl(): {
  processLeftFrame: (landmarks: Landmark[] | null, gesture: GestureName) => void
} {
  // --- scroll loop state ---
  const scrollDirRef = useRef<'up' | 'down' | null>(null)
  const scrollSpeedRef = useRef(0)               // proportional speed updated each camera frame
  const rafRef = useRef<number | null>(null)
  const scrollAnchorY = useRef<number | null>(null)

  // --- grab/drag state ---
  const grabActiveRef = useRef(false)            // true = mouseDown already sent to OS
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
    if (rafRef.current !== null) return // already running
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

  // Cancel scroll loop and release any held OS drag on unmount.
  useEffect(() => () => {
    stopScrollLoop()
    if (grabActiveRef.current) {
      window.electron.cursor.mouseUp()
      grabActiveRef.current = false
    }
  }, [stopScrollLoop])

  // ----- per-frame processor (called from CameraView) -----
  const processLeftFrame = useCallback(
    (landmarks: Landmark[] | null, gesture: GestureName): void => {
      if (!landmarks) {
        stopScrollLoop()
        // Release OS drag if hand disappears mid-grab.
        if (grabActiveRef.current) {
          window.electron.cursor.mouseUp()
          grabActiveRef.current = false
        }
        prevPosRef.current = null
        setGrabbing(false)
        setRotationDelta(0, 0)
        return
      }

      const wrist = landmarks[0]
      const isGrab = gesture === 'fist' || gesture === 'thumbs-up'

      if (gesture === 'v-shape') {
        // ----- proportional anchor-and-drag auto-scroll -----
        // Release any grab held from a previous gesture.
        if (grabActiveRef.current) {
          window.electron.cursor.mouseUp()
          grabActiveRef.current = false
        }

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
          scrollDirRef.current = null   // deadzone — pause
          scrollSpeedRef.current = 0
        }
        setScrolling(true, scrollDirRef.current)
        startScrollLoop()
        prevPosRef.current = null
        setGrabbing(false)
        setRotationDelta(0, 0)

      } else if (isGrab) {
        // ----- universal OS-level drag (Strategy B) -----
        // Stop any running scroll loop first.
        stopScrollLoop()
        setGrabbing(true)

        // Press and hold the left mouse button at the first grab frame so the
        // right hand's cursor movements naturally drag whatever is under it —
        // any 3D canvas, slider, or scrollable element in any app.
        if (!grabActiveRef.current) {
          grabActiveRef.current = true
          window.electron.cursor.mouseDown()
        }

        // Also publish deltas to leftHandStore so the internal dashboard
        // ModelViewer keeps working as a bonus visual.
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
        // Any other gesture — idle. Release OS drag if held.
        stopScrollLoop()
        if (grabActiveRef.current) {
          window.electron.cursor.mouseUp()
          grabActiveRef.current = false
        }
        prevPosRef.current = null
        setGrabbing(false)
        setRotationDelta(0, 0)
      }
    },
    [stopScrollLoop, startScrollLoop, setScrolling, setGrabbing, setRotationDelta],
  )

  return { processLeftFrame }
}
