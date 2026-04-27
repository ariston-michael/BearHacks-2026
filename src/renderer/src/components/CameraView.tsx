import { useEffect, useRef, useState } from 'react'
import { Hands, HAND_CONNECTIONS, Results, NormalizedLandmarkList } from '@mediapipe/hands'
import { Camera } from '@mediapipe/camera_utils'
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'
import { classifyGesture, GestureStabilizer } from '../lib/gestureClassifier'
import { useGestureControl } from '../hooks/useGestureControl'
import { useLeftHandControl } from '../hooks/useLeftHandControl'
import { GestureName } from '../types'

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240'

export default function CameraView(): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handsRef = useRef<Hands | null>(null)
  const cameraRef = useRef<Camera | null>(null)
  const fpsRef = useRef({ frames: 0, lastTick: 0 })
  const leftStabilizerRef = useRef(new GestureStabilizer(3))
  const rightStabilizerRef = useRef(new GestureStabilizer(3))
  const { processFrame, isPrecisionMode, isDragMode } = useGestureControl()
  const { processLeftFrame } = useLeftHandControl()

  const [error, setError] = useState<string | null>(null)
  const [handCount, setHandCount] = useState(0)
  const [fps, setFps] = useState(0)

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const onResults = (results: Results): void => {
      // Sync canvas buffer size to actual video resolution
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const landmarks = results.multiHandLandmarks ?? []
      const handedness = results.multiHandedness ?? []

      setHandCount(landmarks.length)

      // Phase 1: classify + stabilize every detected hand so the left-hand
      // gesture is known before we call processFrame for the right hand.
      type HandData = {
        lm: NormalizedLandmarkList
        gesture: GestureName
        displaySide: 'LEFT' | 'RIGHT'
        side: 'left' | 'right'
      }
      const classified: HandData[] = landmarks.map((lm, i) => {
        const label = handedness[i]?.label ?? ''
        const displaySide = label === 'Right' ? 'LEFT' : 'RIGHT'
        const side: 'left' | 'right' = displaySide === 'LEFT' ? 'left' : 'right'
        const raw = classifyGesture(lm, side)
        const stabilizer = side === 'left' ? leftStabilizerRef.current : rightStabilizerRef.current
        return { lm, gesture: stabilizer.update(raw), displaySide, side }
      })

      const leftHand = classified.find((h) => h.side === 'left')
      const leftGesture = leftHand?.gesture ?? 'none'

      // Dispatch left-hand controls (scroll + 3D rotation).
      processLeftFrame(leftHand?.lm ?? null, leftGesture)

      // Phase 2: draw landmarks + labels, then dispatch cursor control.
      for (const { lm, gesture, displaySide, side } of classified) {
        drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: '#00ff88', lineWidth: 2 })
        drawLandmarks(ctx, lm, { color: '#ff4444', fillColor: '#ff4444', lineWidth: 1, radius: 4 })

        if (side === 'right') processFrame(lm, gesture, leftGesture)

        // Flip canvas context so the label text is readable under CSS scaleX(-1).
        const wrist = lm[0]
        const screenX = (1 - wrist.x) * canvas.width
        const screenY = Math.max(wrist.y * canvas.height - 12, 16)
        ctx.save()
        ctx.scale(-1, 1)
        ctx.translate(-canvas.width, 0)
        ctx.font = 'bold 14px monospace'
        ctx.fillStyle = displaySide === 'LEFT' ? '#6366f1' : '#22d3ee'
        ctx.fillText(`${displaySide}: ${gesture}`, screenX - 50, screenY)
        ctx.restore()
      }

      // FPS
      fpsRef.current.frames++
      const now = Date.now()
      if (fpsRef.current.lastTick === 0) {
        fpsRef.current.lastTick = now
      }
      if (now - fpsRef.current.lastTick >= 1000) {
        setFps(fpsRef.current.frames)
        fpsRef.current.frames = 0
        fpsRef.current.lastTick = now
      }
    }

    let hands: Hands
    let camera: Camera

    try {
      hands = new Hands({ locateFile: (f) => `${MEDIAPIPE_CDN}/${f}` })
      handsRef.current = hands

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
      })

      hands.onResults(onResults)

      camera = new Camera(video, {
        onFrame: async () => {
          await hands.send({ image: video })
        },
        width: 640,
        height: 480
      })
      cameraRef.current = camera

      camera.start().catch((err: Error) => {
        setError(`Camera error: ${err.message}`)
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      queueMicrotask(() => setError(`MediaPipe initialization error: ${msg}`))
      return
    }

    return () => {
      cameraRef.current?.stop()
      handsRef.current?.close()
      handsRef.current = null
      cameraRef.current = null
    }
  }, [])

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-[#0a0a1a]">
        <div className="bg-red-900/40 border border-red-500 rounded-lg p-6 max-w-md text-center">
          <p className="text-red-400 font-mono text-sm whitespace-pre-wrap">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#0a0a1a]">
      {/* Mirrored video + canvas stack */}
      <div className="relative" style={{ width: 640, height: 480 }}>
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* No-hands overlay */}
        {handCount === 0 && (
          <div className="absolute inset-0 flex items-end justify-center pb-4 pointer-events-none">
            <span className="text-white/40 text-sm font-mono">No hands detected</span>
          </div>
        )}

        {/* Precision mode badge */}
        {isPrecisionMode && (
          <div className="absolute top-2 left-2 bg-indigo-500/80 text-white text-xs font-mono font-bold px-2 py-1 rounded">
            PRECISION
          </div>
        )}

        {/* FPS badge */}
        <div className="absolute top-2 right-2 bg-black/60 text-green-400 text-xs font-mono px-2 py-1 rounded">
          {fps} FPS
        </div>

        {/* Drag mode badge */}
        {isDragMode && (
          <div className="absolute top-10 right-2 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-semibold animate-pulse">
            DRAG MODE
          </div>
        )}

      </div>
    </div>
  )
}
