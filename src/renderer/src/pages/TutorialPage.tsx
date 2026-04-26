import TutorialHandViewer, { GesturePose } from '../components/TutorialHandViewer'

interface GestureCard {
  pose: GesturePose
  color: string
  name: string
  hand: 'Right hand' | 'Left hand'
  action: string
  description: string
}

const CARDS: GestureCard[] = [
  {
    pose: 'open-palm',
    color: '#22d3ee',
    name: 'Open Palm',
    hand: 'Right hand',
    action: 'Move cursor',
    description:
      'Hold your right palm open and move your hand to control the OS cursor. Switch to left hand open palm to enter Precision Mode (0.4× speed).',
  },
  {
    pose: 'pinch',
    color: '#f472b6',
    name: 'Pinch',
    hand: 'Right hand',
    action: 'Click & Drag',
    description:
      'Bring your right thumb and index finger together to press and hold the left mouse button. Move while pinched to drag. Release fingers to drop.',
  },
  {
    pose: 'v-shape',
    color: '#818cf8',
    name: 'V-Shape',
    hand: 'Left hand',
    action: 'Scroll page',
    description:
      'Make a V-sign with your left hand. Hold the pose, then tilt up to scroll up or down to scroll down. Speed scales with how far you move past the deadzone.',
  },
  {
    pose: 'fist',
    color: '#fb923c',
    name: 'Fist / Thumbs-up',
    hand: 'Left hand',
    action: 'Orbit 3D camera',
    description:
      'Close your left fist (or give a thumbs-up) and move your hand to orbit the 3D camera in Blender, Three.js, or any app that uses Middle Mouse Button rotation.',
  },
]

export default function TutorialPage(): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      {/* Page header */}
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-white/40">
          AirControl &rsaquo; Tutorial
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Gesture Guide</h1>
        <p className="mt-1 text-sm text-white/50">
          Learn each hand gesture and what it controls at the OS level. The skeleton preview below
          each card rotates so you can see the pose from every angle.
        </p>
      </div>

      {/* Legend chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Right hand', color: 'text-cyan-400 bg-cyan-500/10 ring-cyan-500/30' },
          { label: 'Left hand', color: 'text-indigo-400 bg-indigo-500/10 ring-indigo-500/30' },
        ].map(({ label, color }) => (
          <span
            key={label}
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${color}`}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Gesture card grid */}
      <div className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-2">
        {CARDS.map((card) => (
          <div
            key={card.pose}
            className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-lg transition-shadow hover:shadow-xl hover:shadow-black/40"
          >
            {/* 3D hand preview */}
            <TutorialHandViewer pose={card.pose} color={card.color} />

            {/* Card body */}
            <div className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-white">{card.name}</h2>
                  <p
                    className="text-xs font-medium"
                    style={{ color: card.color }}
                  >
                    {card.action}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                    card.hand === 'Right hand'
                      ? 'bg-cyan-500/10 text-cyan-400 ring-cyan-500/30'
                      : 'bg-indigo-500/10 text-indigo-400 ring-indigo-500/30'
                  }`}
                >
                  {card.hand}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-white/60">{card.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer tip */}
      <p className="shrink-0 text-center text-xs text-white/30">
        Tip: Use the <span className="text-white/50">Dashboard</span> to see your live gesture
        labels and FPS in real time.
      </p>
    </div>
  )
}

