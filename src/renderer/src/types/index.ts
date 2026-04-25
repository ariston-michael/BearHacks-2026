// Shared TypeScript types used across the renderer: gesture names, landmark shapes,
// calibration data, action intents, and store interfaces.

export type GestureName =
  | 'pinch'
  | 'palm'
  | 'fist'
  | 'point'
  | 'c-shape'
  | 'v-sign'
  | 'ok-sign'
  | null

export interface Landmark {
  x: number
  y: number
  z: number
}

export interface CalibrationData {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type GestureIntent = string | null
