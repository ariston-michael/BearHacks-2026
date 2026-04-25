export type Vector2 = { x: number; y: number }

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value))
}

export class ExponentialSmoother {
  private readonly smoothingFactor: number
  private hasValue = false
  private currentValue = 0

  constructor(smoothingFactor = 0.3) {
    this.smoothingFactor = clamp(smoothingFactor, 0, 1)
  }

  update(value: number): number {
    if (!this.hasValue) {
      this.hasValue = true
      this.currentValue = value
      return this.currentValue
    }

    this.currentValue = this.currentValue + this.smoothingFactor * (value - this.currentValue)
    return this.currentValue
  }

  reset(): void {
    this.hasValue = false
    this.currentValue = 0
  }
}

export class Vector2Smoother {
  private readonly xSmoother: ExponentialSmoother
  private readonly ySmoother: ExponentialSmoother

  constructor(smoothingFactor = 0.3) {
    this.xSmoother = new ExponentialSmoother(smoothingFactor)
    this.ySmoother = new ExponentialSmoother(smoothingFactor)
  }

  update(value: Vector2): Vector2 {
    return {
      x: this.xSmoother.update(value.x),
      y: this.ySmoother.update(value.y)
    }
  }

  reset(): void {
    this.xSmoother.reset()
    this.ySmoother.reset()
  }
}
