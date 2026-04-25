// Zustand store for user-configurable settings: cursor sensitivity, smoothing alpha,
// gesture bindings, active camera index, and per-gesture enable/disable toggles.
// Persisted to disk via electron-store through the IPC bridge.

import { create } from 'zustand'

interface SettingsState {
  sensitivity: number
  smoothingAlpha: number
  setSensitivity: (v: number) => void
  setSmoothingAlpha: (v: number) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  sensitivity: 1.0,
  smoothingAlpha: 0.3,
  setSensitivity: (v) => set({ sensitivity: v }),
  setSmoothingAlpha: (v) => set({ smoothingAlpha: v }),
}))
