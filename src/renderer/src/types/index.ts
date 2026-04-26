// Shared TypeScript types used across the renderer: gesture names, landmark shapes,
// calibration data, action intents, and store interfaces.

export type GestureName =
  | 'pinch'
  | 'devil-horns'
  | 'fist'
  | 'open-palm'
  | 'point'
  | 'okay-sign'
  | 'c-shape'
  | 'v-shape'
  | 'thumbs-up'
  | 'none'

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
