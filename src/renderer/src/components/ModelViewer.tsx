import { useEffect, useRef } from 'react'
import { useLeftHandStore } from '../stores/leftHandStore'

const FACES = [
  { transform: 'translateZ(48px)',             bg: 'bg-indigo-600/80',  label: 'FRONT'  },
  { transform: 'rotateY(180deg) translateZ(48px)', bg: 'bg-indigo-900/80',  label: 'BACK'   },
  { transform: 'rotateY(90deg) translateZ(48px)',  bg: 'bg-violet-600/80',  label: 'RIGHT'  },
  { transform: 'rotateY(-90deg) translateZ(48px)', bg: 'bg-violet-900/80',  label: 'LEFT'   },
  { transform: 'rotateX(90deg) translateZ(48px)',  bg: 'bg-purple-500/80',  label: 'TOP'    },
  { transform: 'rotateX(-90deg) translateZ(48px)', bg: 'bg-purple-800/80',  label: 'BOTTOM' },
] as const

export default function ModelViewer(): React.JSX.Element {
  const rotX = useRef(20)
  const rotY = useRef(-30)
  const boxRef = useRef<HTMLDivElement>(null)

  const rotationDeltaX = useLeftHandStore((s) => s.rotationDeltaX)
  const rotationDeltaY = useLeftHandStore((s) => s.rotationDeltaY)
  const isGrabbing = useLeftHandStore((s) => s.isGrabbing)
  const isScrolling = useLeftHandStore((s) => s.isScrolling)
  const scrollTilt = useLeftHandStore((s) => s.scrollTilt)

  // Apply incoming rotation deltas to the accumulated angles.
  useEffect(() => {
    if (rotationDeltaX === 0 && rotationDeltaY === 0) return
    // Hand moving right (positive deltaX in mediapipe) → rotate model around Y axis.
    // Hand moving down (positive deltaY in mediapipe) → rotate model around X axis.
    rotY.current += rotationDeltaX
    rotX.current += rotationDeltaY
    if (boxRef.current) {
      boxRef.current.style.transform = `rotateX(${rotX.current}deg) rotateY(${rotY.current}deg)`
    }
  }, [rotationDeltaX, rotationDeltaY])

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="text-lg font-semibold text-white mb-1">3D Model Viewer</h2>
      <p className="text-sm text-white/50 mb-4">
        Left hand:&nbsp;
        <span className="font-mono text-indigo-400">fist + move</span> = rotate &nbsp;|&nbsp;
        <span className="font-mono text-violet-400">v-shape + move</span> = scroll page
      </p>

      <div className="flex items-center gap-6">
        {/* Status badges */}
        <div className="flex flex-col gap-2 text-xs font-mono w-44">
          <span
            className={`rounded-full px-3 py-1 text-center transition-colors ${
              isGrabbing
                ? 'bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-400'
                : 'bg-white/5 text-white/30'
            }`}
          >
            {isGrabbing ? '● GRABBING — rotating' : 'fist / 👍 to rotate'}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-center transition-colors ${
              isScrolling
                ? 'bg-violet-500/30 text-violet-300 ring-1 ring-violet-400'
                : 'bg-white/5 text-white/30'
            }`}
          >
            {isScrolling
              ? `● SCROLLING ${scrollTilt === 'up' ? '▲' : scrollTilt === 'down' ? '▼' : '⏸'}`
              : 'v-shape to scroll'}
          </span>
        </div>

        {/* CSS 3D cube */}
        <div style={{ perspective: '600px' }} className="flex items-center justify-center w-48 h-48">
          <div
            ref={boxRef}
            style={{
              width: 96,
              height: 96,
              transformStyle: 'preserve-3d',
              transform: `rotateX(${rotX.current}deg) rotateY(${rotY.current}deg)`,
              // Snap off transition while actively grabbing to eliminate lag.
              transition: isGrabbing ? 'none' : 'transform 0.12s ease-out',
            }}
          >
            {FACES.map(({ transform, bg, label }) => (
              <div
                key={label}
                style={{
                  transform,
                  width: 96,
                  height: 96,
                  position: 'absolute',
                  backfaceVisibility: 'hidden',
                }}
                className={`${bg} border border-white/20 flex items-center justify-center text-white text-xs font-bold`}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
