// Zustand store for user-configurable settings: cursor sensitivity, click delay,
// selected camera, and calibration profile. Persisted to disk via the
// electronStorePersist middleware, which proxies through Electron IPC to the
// main-process electron-store instance.
//
// Note: `isActive` is intentionally excluded from persistence so the app always
// boots in an inactive state.

import { create } from 'zustand'
import type { AppSettings, CalibrationProfile } from '../types'
import { electronStorePersist } from './electronStorePersist'

interface SettingsState extends AppSettings {
  updateSettings: (_partial: Partial<AppSettings>) => void
  resetToDefaults: () => void
  setCalibration: (_profile: CalibrationProfile | null) => void
}

const DEFAULT_SETTINGS: AppSettings = {
  sensitivity: 1.0,
  clickDelay: 250,
  selectedCameraId: null,
  calibration: null,
  isActive: false
}

export const useSettingsStore = create<SettingsState>()(
  electronStorePersist<SettingsState>(
    (_set) => ({
      ...DEFAULT_SETTINGS,
      updateSettings: (_partial) => _set(_partial),
      resetToDefaults: () => _set({ ...DEFAULT_SETTINGS }),
      setCalibration: (_profile) => _set({ calibration: _profile })
    }),
    {
      key: 'app-settings',
      partialize: (_state) => ({
        sensitivity: _state.sensitivity,
        clickDelay: _state.clickDelay,
        selectedCameraId: _state.selectedCameraId,
        calibration: _state.calibration
      })
    }
  )
)
