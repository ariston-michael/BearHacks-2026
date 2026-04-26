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
      'Hold your right palm open and move your hand to control the OS cursor. Switch to left hand open palm to enter Precision Mode (0.4× speed) for fine pixel-level control.',
  },
  {
    pose: 'devil-horns',
    color: '#f43f5e',
    name: 'Devil Horns',
    hand: 'Right hand',
    action: 'Click',
    description:
      'Extend your right index finger and pinky while curling the middle and ring fingers. Each time you form the gesture the left mouse button fires — release and re-form to click again.',
  },
  {
    pose: 'point',
    color: '#facc15',
    name: 'Point',
    hand: 'Right hand',
    action: 'Precision cursor',
    description:
      'Extend only your right index finger with all other fingers curled. Activates Precision Mode for fine-grained cursor control at reduced speed.',
  },
  {
    pose: 'v-shape',
    color: '#818cf8',
    name: 'V-Shape',
    hand: 'Left hand',
    action: 'Scroll page',
    description:
      'Make a V-sign (peace sign) with your left hand. Tilt up to scroll up or down to scroll down. Speed scales with how far you move past the deadzone.',
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
  {
    pose: 'open-palm',
    color: '#34d399',
    name: 'Open Palm',
    hand: 'Left hand',
    action: 'Precision Mode',
    description:
      'Hold your left palm open while moving the right hand to activate Precision Mode — right-hand cursor speed drops to 0.4× for pixel-perfect positioning.',
  },
]

interface VoiceCommand {
  phrase: string
  action: string
  example: string
}

const VOICE_COMMANDS: VoiceCommand[] = [
  {
    phrase: 'Open app',
    action: 'Launch or focus an application',
    example: '"Open Spotify" · "Open Chrome" · "Open terminal"',
  },
  {
    phrase: 'Open URL',
    action: 'Navigate to a website',
    example: '"Open github.com" · "Open youtube.com"',
  },
  {
    phrase: 'Search for…',
    action: 'Web search in default browser',
    example: '"Search for TypeScript tutorials" · "Search React hooks"',
  },
  {
    phrase: 'Open … with query',
    action: 'Launch app with a search query',
    example: '"Open YouTube with lofi music"',
  },
  {
    phrase: 'Select link / Click link',
    action: 'Click a link or button on screen by name',
    example: '"Select Sign In" · "Click Download"',
  },
  {
    phrase: 'What does … mean / Summarise',
    action: 'Answer a question about the current page',
    example: '"What does this page say about pricing?"',
  },
  {
    phrase: 'Play … on Spotify',
    action: 'Search Spotify for a track or artist',
    example: '"Play Daft Punk on Spotify"',
  },
  {
    phrase: 'Scroll up / Scroll down',
    action: 'Scroll the current window',
    example: '"Scroll down" · "Scroll to the top"',
  },
  {
    phrase: 'Click',
    action: 'Left-click at the current cursor position',
    example: '"Click" · "Click here"',
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
          Learn each hand gesture and voice command. The skeleton preview rotates so you can see the
          pose from every angle.
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
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card, idx) => (
          <div
            key={`${card.pose}-${idx}`}
            className="flex flex-col overflow-hidden rounded-xl border border-white/[0.09] bg-white/[0.04] backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_4px_24px_rgba(0,0,0,0.2)] transition-shadow hover:shadow-xl hover:border-white/20"
          >
            {/* 3D hand preview */}
            <TutorialHandViewer pose={card.pose} color={card.color} />

            {/* Card body */}
            <div className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-white">{card.name}</h2>
                  <p className="text-xs font-medium" style={{ color: card.color }}>
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

      {/* Voice Commands section */}
      <div className="mt-2">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Voice Commands</h2>
          <p className="mt-1 text-sm text-white/50">
            Say{' '}
            <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 font-mono text-xs text-indigo-300">
              Hey Air Control
            </span>{' '}
            to activate the microphone, then speak one of the commands below.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {VOICE_COMMANDS.map((cmd) => (
            <div
              key={cmd.phrase}
              className="flex flex-col gap-1 rounded-xl border border-white/[0.09] bg-white/[0.04] backdrop-blur-xl p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_4px_24px_rgba(0,0,0,0.2)] sm:flex-row sm:items-start sm:gap-4"
            >
              <div className="shrink-0 sm:w-44">
                <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-semibold text-violet-300 ring-1 ring-violet-500/30">
                  {cmd.phrase}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-white/80">{cmd.action}</p>
                <p className="text-xs text-white/40 italic">{cmd.example}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer tip */}
      <p className="shrink-0 text-center text-xs text-white/30">
        Tip: Use the <span className="text-white/50">Dashboard</span> to see your live gesture
        labels and FPS in real time.
      </p>
    </div>
  )
}
