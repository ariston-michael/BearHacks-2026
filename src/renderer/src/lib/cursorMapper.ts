export type NormalizedPoint = { x: number; y: number }

export type CursorPoint = { x: number; y: number }

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value))
}

const smoothstep = (value: number): number => {
  const t = clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

export function mapHandToCursor(
  landmark: NormalizedPoint,
  screenWidth: number,
  screenHeight: number,
  sensitivity = 1.0
): CursorPoint {
  const safeWidth = Math.max(1, screenWidth)
  const safeHeight = Math.max(1, screenHeight)
  const safeSensitivity = Math.max(0, sensitivity)

  const xNorm = clamp(landmark.x, 0, 1)
  const yNorm = clamp(landmark.y, 0, 1)

  // Convert to centered space where (0, 0) is screen center and axis range is [-1, 1].
  let centeredX = (xNorm - 0.5) * 2 * safeSensitivity
  let centeredY = (yNorm - 0.5) * 2 * safeSensitivity

  const magnitude = Math.hypot(centeredX, centeredY)
  if (magnitude > 0) {
    // Dead-zone style response: less motion near center, more motion farther out.
    const curvedMagnitude = smoothstep(clamp(magnitude, 0, 1))
    const scale = curvedMagnitude / magnitude
    centeredX *= scale
    centeredY *= scale
  }

  const cursorX = clamp((centeredX / 2 + 0.5) * safeWidth, 0, safeWidth)
  const cursorY = clamp((centeredY / 2 + 0.5) * safeHeight, 0, safeHeight)

  return { x: cursorX, y: cursorY }
}
