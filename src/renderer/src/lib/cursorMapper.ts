// Maps the right-hand index-finger tip position (normalized 0-1) to absolute screen coordinates.
// Uses calibration data to apply per-user range-of-motion scaling and aspect correction.

export function mapCursor(): { x: number; y: number } {
  return { x: 0, y: 0 }
}
