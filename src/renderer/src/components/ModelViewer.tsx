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
    <section className="relative rounded-xl border border-white/10 bg-white/5 p-4">
      <span className="text-sm text-white/50">3D Model</span>

      {/* Status badges — top-right, only visible when active */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
        {isGrabbing && (
          <span className="rounded-full bg-indigo-500/30 px-2.5 py-0.5 text-xs font-mono text-indigo-300 ring-1 ring-indigo-400">
            ● GRABBING
          </span>
        )}
        {isScrolling && (
          <span className="rounded-full bg-violet-500/30 px-2.5 py-0.5 text-xs font-mono text-violet-300 ring-1 ring-violet-400">
            ● SCROLLING {scrollTilt === 'up' ? '▲' : scrollTilt === 'down' ? '▼' : '⏸'}
          </span>
        )}
      </div>

      {/* Cube centered in a fixed-height area */}
      <div style={{ perspective: '600px' }} className="flex items-center justify-center h-60">
        <div
          ref={boxRef}
          style={{
            width: 96,
            height: 96,
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotX.current}deg) rotateY(${rotY.current}deg)`,
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

      <p className="text-center text-xs text-white/30">
        Left hand: fist to rotate · v-shape to scroll
      </p>
    </section>
  )
}
