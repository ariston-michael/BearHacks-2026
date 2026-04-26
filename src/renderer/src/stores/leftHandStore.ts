import { create } from 'zustand'

interface LeftHandState {
  isScrolling: boolean
  scrollTilt: 'up' | 'down' | null
  isGrabbing: boolean
  rotationDeltaX: number
  rotationDeltaY: number
  setScrolling: (v: boolean, tilt?: 'up' | 'down' | null) => void
  setGrabbing: (v: boolean) => void
  setRotationDelta: (dx: number, dy: number) => void
}

export const useLeftHandStore = create<LeftHandState>((set) => ({
  isScrolling: false,
  scrollTilt: null,
  isGrabbing: false,
  rotationDeltaX: 0,
  rotationDeltaY: 0,
  setScrolling: (v, tilt = null) => set({ isScrolling: v, scrollTilt: v ? tilt : null }),
  setGrabbing: (v) => set({ isGrabbing: v }),
  setRotationDelta: (dx, dy) => set({ rotationDeltaX: dx, rotationDeltaY: dy }),
}))
