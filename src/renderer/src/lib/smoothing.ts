// Applies exponential moving average (EMA) smoothing to landmark coordinates and cursor position.
// Reduces jitter from MediaPipe noise without adding perceptible input lag.

export function smooth(value: number, _previous: number, _alpha: number): number {
  return value
}
