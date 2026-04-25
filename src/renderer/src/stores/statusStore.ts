// Zustand store for runtime system status: whether AirControl is currently
// active, hand-detection FPS, the most recent error message, and whether
// the camera is connected. No persistence — this is real-time runtime state.

import { create } from 'zustand'

interface StatusState {
  isActive: boolean
  fps: number
  errorMessage: string | null
  cameraConnected: boolean
  setIsActive: (_value: boolean) => void
  setFps: (_value: number) => void
  setErrorMessage: (_value: string | null) => void
  setCameraConnected: (_value: boolean) => void
}

export const useStatusStore = create<StatusState>((_set) => ({
  isActive: false,
  fps: 0,
  errorMessage: null,
  cameraConnected: false,
  setIsActive: (_value) => _set({ isActive: _value }),
  setFps: (_value) => _set({ fps: _value }),
  setErrorMessage: (_value) => _set({ errorMessage: _value }),
  setCameraConnected: (_value) => _set({ cameraConnected: _value })
}))
