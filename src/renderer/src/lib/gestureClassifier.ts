import { GestureName, Landmark } from '../types'

// MediaPipe landmark index groups: [MCP, PIP, DIP, TIP]
const FINGERS = {
  index:  [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring:   [13, 14, 15, 16],
  pinky:  [17, 18, 19, 20],
} as const

type FingerKey = keyof typeof FINGERS

function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// TIP y < PIP y  →  finger is pointing up (extended).
// y increases downward in MediaPipe normalized coords.
export function isFingerExtended(lm: Landmark[], finger: FingerKey): boolean {
  const [, pip, , tip] = FINGERS[finger]
  return lm[tip].y < lm[pip].y
}

// Fist curl: tip is closer to the wrist than the MCP is (with 10% margin).
// More reliable than y-axis comparison alone because it works at any hand angle.
export function isFingerCurledToWrist(lm: Landmark[], finger: FingerKey): boolean {
  const [mcp, , , tip] = FINGERS[finger]
  return dist(lm[tip], lm[0]) < dist(lm[mcp], lm[0]) * 1.1
}

// TIP past PIP but not past MCP  →  moderate C-shape curl.
export function isFingerModeratelyCurled(lm: Landmark[], finger: FingerKey): boolean {
  const [mcp, pip, , tip] = FINGERS[finger]
  return lm[tip].y > lm[pip].y && lm[tip].y < lm[mcp].y
}

// Thumb tip close to index tip in normalized 2-D distance.
export function isPinching(lm: Landmark[]): boolean {
  return dist(lm[4], lm[8]) < 0.05
}

// Thumb tip clearly above the thumb MCP and the wrist → thumb points up.
export function isThumbUp(lm: Landmark[]): boolean {
  return lm[4].y < lm[2].y && lm[4].y < lm[0].y
}

export function classifyGesture(
  landmarks: Landmark[],
  _handedness: 'left' | 'right'
): GestureName {
  void _handedness
  const lm = landmarks

  const index  = isFingerExtended(lm, 'index')
  const middle = isFingerExtended(lm, 'middle')
  const ring   = isFingerExtended(lm, 'ring')
  const pinky  = isFingerExtended(lm, 'pinky')
  const pinch  = isPinching(lm)

  // okay-sign before plain pinch: same thumb–index contact, others extended.
  if (pinch && middle && ring && pinky) return 'okay-sign'

  // Pinch: thumb tip and index tip very close, other fingers not all extended.
  if (pinch) return 'pinch'

  // Thumbs-up: all four fingers curled, thumb clearly pointing up.
  if (!index && !middle && !ring && !pinky && isThumbUp(lm)) return 'thumbs-up'

  // Point: only index extended.
  if (index && !middle && !ring && !pinky) return 'point'

  // V-shape: index and middle extended, ring and pinky curled.
  if (index && middle && !ring && !pinky) return 'v-shape'

  // Open palm: all four fingers extended.
  if (index && middle && ring && pinky) return 'open-palm'

  // Fist: all four fingertips closer to the wrist than their MCP joints are.
  const fingers = ['index', 'middle', 'ring', 'pinky'] as FingerKey[]
  if (fingers.every((f) => isFingerCurledToWrist(lm, f))) return 'fist'

  // C-shape: at least three fingers moderately curled (past PIP, not past MCP).
  if (fingers.filter((f) => isFingerModeratelyCurled(lm, f)).length >= 3) return 'c-shape'

  return 'none'
}

export class GestureStabilizer {
  private history: GestureName[] = []
  private stableGesture: GestureName = 'none'
  private readonly requiredFrames: number

  constructor(requiredFrames: number = 3) {
    this.requiredFrames = requiredFrames
  }

  update(gesture: GestureName): GestureName {
    this.history.push(gesture)
    if (this.history.length > this.requiredFrames) {
      this.history.shift()
    }
    if (
      this.history.length === this.requiredFrames &&
      this.history.every((g) => g === gesture)
    ) {
      this.stableGesture = gesture
    }
    return this.stableGesture
  }

  reset(): void {
    this.history = []
    this.stableGesture = 'none'
  }
}
