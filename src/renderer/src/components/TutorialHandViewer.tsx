/**
 * SVG-based MediaPipe hand skeleton viewer.
 * Renders hardcoded landmark poses as glowing joint nodes + bone lines,
 * with a slow CSS perspective-tilt animation to give the illusion of depth.
 * No Three.js / r3f required.
 */

// MediaPipe hand connections: pairs of landmark indices
const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],           // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],           // index
  [0, 9], [9, 10], [10, 11], [11, 12],      // middle
  [0, 13], [13, 14], [14, 15], [15, 16],    // ring
  [0, 17], [17, 18], [18, 19], [19, 20],    // pinky
  [5, 9], [9, 13], [13, 17],                // palm knuckle bar
]

// Each pose is an array of 21 [x, y] coords in SVG-space (0–200 × 0–220).
export type GesturePose = 'open-palm' | 'pinch' | 'v-shape' | 'fist'

const POSES: Record<GesturePose, [number, number][]> = {
  'open-palm': [
    [100, 175], // 0 wrist
    [78, 153],  // 1 thumb CMC
    [60, 132],  // 2 thumb MCP
    [46, 116],  // 3 thumb IP
    [34, 100],  // 4 thumb TIP
    [84, 128],  // 5 index MCP
    [82, 100],  // 6 index PIP
    [80, 76],   // 7 index DIP
    [79, 54],   // 8 index TIP
    [100, 125], // 9 middle MCP
    [99, 95],   // 10 middle PIP
    [98, 70],   // 11 middle DIP
    [97, 48],   // 12 middle TIP
    [116, 127], // 13 ring MCP
    [117, 98],  // 14 ring PIP
    [117, 74],  // 15 ring DIP
    [117, 54],  // 16 ring TIP
    [130, 133], // 17 pinky MCP
    [133, 108], // 18 pinky PIP
    [135, 88],  // 19 pinky DIP
    [137, 70],  // 20 pinky TIP
  ],
  'pinch': [
    [100, 172], // 0 wrist
    [82, 150],  // 1
    [70, 132],  // 2
    [66, 114],  // 3
    [80, 98],   // 4 thumb TIP ← meets index tip
    [88, 122],  // 5
    [87, 107],  // 6
    [84, 100],  // 7
    [80, 98],   // 8 index TIP ← meets thumb tip
    [100, 120], // 9
    [100, 102], // 10
    [100, 88],  // 11
    [100, 76],  // 12
    [114, 122], // 13
    [115, 105], // 14
    [115, 93],  // 15
    [115, 82],  // 16
    [126, 128], // 17
    [129, 114], // 18
    [130, 104], // 19
    [130, 94],  // 20
  ],
  'v-shape': [
    [100, 172], // 0 wrist
    [80, 152],  // 1
    [66, 134],  // 2
    [56, 118],  // 3
    [50, 104],  // 4 thumb tip
    [84, 124],  // 5 index MCP
    [80, 96],   // 6 index PIP
    [78, 72],   // 7 index DIP
    [76, 50],   // 8 index TIP (extended + spread)
    [100, 121], // 9 middle MCP
    [99, 93],   // 10 middle PIP
    [98, 70],   // 11 middle DIP
    [98, 48],   // 12 middle TIP (extended)
    [115, 124], // 13 ring MCP
    [116, 110], // 14 ring PIP — curled
    [115, 102], // 15
    [113, 97],  // 16 ring TIP (curled)
    [127, 129], // 17 pinky MCP
    [130, 118], // 18 pinky PIP — curled
    [130, 111], // 19
    [128, 107], // 20 pinky TIP (curled)
  ],
  'fist': [
    [100, 166], // 0 wrist
    [80, 146],  // 1
    [68, 128],  // 2
    [64, 116],  // 3
    [72, 106],  // 4 thumb tip (tucked to side)
    [84, 120],  // 5 index MCP
    [82, 106],  // 6 index PIP — curled
    [84, 98],   // 7
    [90, 94],   // 8 index TIP (curled tight)
    [98, 117],  // 9 middle MCP
    [97, 102],  // 10 — curled
    [99, 94],   // 11
    [104, 91],  // 12 middle TIP (curled)
    [113, 118], // 13 ring MCP
    [113, 104], // 14 — curled
    [112, 97],  // 15
    [112, 93],  // 16 ring TIP
    [125, 124], // 17 pinky MCP
    [128, 113], // 18 — curled
    [128, 107], // 19
    [126, 103], // 20 pinky TIP
  ],
}

// Tip indices to render with a brighter accent
const TIP_INDICES = new Set([4, 8, 12, 16, 20])

interface Props {
  pose: GesturePose
  /** Accent colour for the glowing joints, default indigo */
  color?: string
}

export default function TutorialHandViewer({ pose, color = '#818cf8' }: Props): React.JSX.Element {
  const pts = POSES[pose]

  return (
    <div
      className="relative w-full overflow-hidden rounded-t-xl"
      style={{
        background: 'linear-gradient(160deg, #0d0d2b 0%, #0a0a1a 100%)',
        height: 200,
      }}
    >
      {/* subtle grid dots */}
      <svg
        className="absolute inset-0 opacity-10"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id={`grid-${pose}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#fff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grid-${pose})`} />
      </svg>

      {/* Hand skeleton — slow oscillating tilt via CSS animation */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ animation: 'handSway 4s ease-in-out infinite' }}
      >
        <svg
          viewBox="20 40 160 150"
          width="160"
          height="150"
          xmlns="http://www.w3.org/2000/svg"
          style={{ overflow: 'visible', filter: `drop-shadow(0 0 6px ${color}99)` }}
        >
          {/* Bones */}
          {CONNECTIONS.map(([a, b], i) => (
            <line
              key={i}
              x1={pts[a][0]}
              y1={pts[a][1]}
              x2={pts[b][0]}
              y2={pts[b][1]}
              stroke={color}
              strokeWidth="2"
              strokeOpacity="0.55"
              strokeLinecap="round"
            />
          ))}
          {/* Joints */}
          {pts.map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={TIP_INDICES.has(i) ? 4.5 : i === 0 ? 5 : 3}
              fill={TIP_INDICES.has(i) ? color : '#1e1b4b'}
              stroke={color}
              strokeWidth={TIP_INDICES.has(i) ? 1.5 : 1}
              strokeOpacity="0.9"
            />
          ))}
        </svg>
      </div>

      {/* CSS keyframe animation injected once */}
      <style>{`
        @keyframes handSway {
          0%   { transform: perspective(400px) rotateY(-12deg) rotateX(4deg); }
          50%  { transform: perspective(400px) rotateY(12deg)  rotateX(-4deg); }
          100% { transform: perspective(400px) rotateY(-12deg) rotateX(4deg); }
        }
      `}</style>
    </div>
  )
}
