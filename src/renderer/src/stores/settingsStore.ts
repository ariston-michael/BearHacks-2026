// Zustand store for user-configurable settings: cursor sensitivity, smoothing alpha,
// gesture bindings, active camera index, and per-gesture enable/disable toggles.
// Persisted to disk via electron-store through the IPC bridge.

import { create } from 'zustand'

interface SettingsState {
  sensitivity: number
  smoothingAlpha: number
  selectedCameraId: string
  selectedAudioId: string
  isCalibrating: boolean
  calibrationBounds: { minX: number; maxX: number; minY: number; maxY: number } | null
  setSensitivity: (v: number) => void
  setSmoothingAlpha: (v: number) => void
  setSelectedCameraId: (id: string) => void
  setSelectedAudioId: (id: string) => void
  setIsCalibrating: (v: boolean) => void
  setCalibrationBounds: (bounds: { minX: number; maxX: number; minY: number; maxY: number } | null) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  sensitivity: 1.0,
  smoothingAlpha: 0.3,
  selectedCameraId: '',
  selectedAudioId: '',
  isCalibrating: false,
  calibrationBounds: null,
  setSensitivity: (v) => set({ sensitivity: v }),
  setSmoothingAlpha: (v) => set({ smoothingAlpha: v }),
  setSelectedCameraId: (id) => set({ selectedCameraId: id }),
  setSelectedAudioId: (id) => set({ selectedAudioId: id }),
  setIsCalibrating: (v) => set({ isCalibrating: v }),
  setCalibrationBounds: (bounds) => set({ calibrationBounds: bounds }),
}))
