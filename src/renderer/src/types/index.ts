// Shared TypeScript types used across the renderer: gesture names, landmark shapes,
// calibration data, action intents, and store interfaces.

export type Hand = 'left' | 'right'

// Existing names kept to avoid breaking gestureClassifier.ts and CameraView.tsx.
// New names appended per the integration spec ('open-palm', 'thumbs-up',
// 'okay-sign', 'v-shape', 'none').
export type GestureName =
  | 'pinch'
  | 'palm'
  | 'fist'
  | 'point'
  | 'c-shape'
  | 'v-sign'
  | 'ok-sign'
  | 'open-palm'
  | 'thumbs-up'
  | 'okay-sign'
  | 'v-shape'
  | 'none'
  | null

export interface Landmark {
  x: number
  y: number
  z: number
}

// Spec alias matching MediaPipe's normalized landmark shape. Structurally
// identical to Landmark so either type can be used interchangeably.
export type HandLandmark = Landmark

export interface DetectedHand {
  hand: Hand
  landmarks: HandLandmark[]
  gesture: GestureName
  confidence: number
}

export interface CalibrationData {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface ActiveRegion {
  topLeft: { x: number; y: number }
  bottomRight: { x: number; y: number }
}

export interface CalibrationProfile {
  sensitivity: number
  activeRegion: ActiveRegion
  clickThreshold: number
  userId: string
}

export interface AppSettings {
  sensitivity: number
  clickDelay: number
  selectedCameraId: string | null
  calibration: CalibrationProfile | null
  isActive: boolean
}

export type GestureIntent = string | null
