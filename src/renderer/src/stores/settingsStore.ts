// Zustand store for user-configurable settings: cursor sensitivity, smoothing alpha,
// gesture bindings, active camera index, and per-gesture enable/disable toggles.
// Persisted to disk via electron-store through the IPC bridge.

import { create } from 'zustand'

export interface CalibrationBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

interface SettingsState {
  // Cursor / gesture tuning
  sensitivity: number
  smoothingAlpha: number
  scrollMultiplier: number

  // Hardware
  selectedCameraId: string
  selectedAudioId: string

  // Calibration
  isCalibrating: boolean
  calibrationBounds: CalibrationBounds | null

  // System
  launchOnStartup: boolean

  // Actions
  setSensitivity: (v: number) => void
  setSmoothingAlpha: (v: number) => void
  setScrollMultiplier: (v: number) => void
  setSelectedCameraId: (id: string) => void
  setSelectedAudioId: (id: string) => void
  setIsCalibrating: (v: boolean) => void
  setCalibrationBounds: (bounds: CalibrationBounds | null) => void
  setLaunchOnStartup: (v: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  sensitivity: 1.0,
  smoothingAlpha: 0.3,
  scrollMultiplier: 50,
  selectedCameraId: '',
  selectedAudioId: '',
  isCalibrating: false,
  calibrationBounds: null,
  launchOnStartup: false,
  setSensitivity: (v) => set({ sensitivity: v }),
  setSmoothingAlpha: (v) => set({ smoothingAlpha: v }),
  setScrollMultiplier: (v) => set({ scrollMultiplier: v }),
  setSelectedCameraId: (id) => set({ selectedCameraId: id }),
  setSelectedAudioId: (id) => set({ selectedAudioId: id }),
  setIsCalibrating: (v) => set({ isCalibrating: v }),
  setCalibrationBounds: (bounds) => set({ calibrationBounds: bounds }),
  setLaunchOnStartup: (v) => set({ launchOnStartup: v }),
}))
