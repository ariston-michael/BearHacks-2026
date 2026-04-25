// Zustand store for runtime system status: camera connection, hand-detection FPS,
// model confidence, and whether AirControl gesture control is currently active.

import { create } from 'zustand'

interface StatusState {
  isActive: boolean
  fps: number
  cameraConnected: boolean
  setIsActive: (v: boolean) => void
  setFps: (v: number) => void
  setCameraConnected: (v: boolean) => void
}

export const useStatusStore = create<StatusState>((set) => ({
  isActive: false,
  fps: 0,
  cameraConnected: false,
  setIsActive: (v) => set({ isActive: v }),
  setFps: (v) => set({ fps: v }),
  setCameraConnected: (v) => set({ cameraConnected: v }),
}))
