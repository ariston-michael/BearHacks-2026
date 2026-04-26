import { ElectronAPI } from '@electron-toolkit/preload'
import type { VoiceExecuteIntentPayload, VoiceExecuteIntentResult } from '../shared/voiceIpc'

interface CursorAPI {
  move: (x: number, y: number) => Promise<void>
  click: () => Promise<void>
  rightClick: () => Promise<void>
  scroll: (deltaY: number) => Promise<void>
  mouseDown: () => Promise<void>
  mouseUp: () => Promise<void>
  middleDown: () => Promise<void>
  middleUp: () => Promise<void>
}

interface KeyboardAPI {
  shortcut: (keys: string[]) => Promise<void>
}

interface SettingsAPI {
  getStartup: () => Promise<boolean>
  setStartup: (v: boolean) => Promise<void>
  getApiKey: (service: string) => Promise<string>
  setApiKey: (service: string, key: string) => Promise<void>
}

interface DisplayAPI {
  getActiveMetrics: () => Promise<{ width: number; height: number; scaleFactor: number }>
}


interface VoiceApi {
  executeIntent: (_payload: VoiceExecuteIntentPayload) => Promise<VoiceExecuteIntentResult>
}

interface AirControlApi {
  voice: VoiceApi
}

type AppElectronAPI = ElectronAPI & {
  cursor: CursorAPI
  keyboard: KeyboardAPI
  settings: SettingsAPI
  display: DisplayAPI

}

declare global {
  interface Window {
    electron: AppElectronAPI
    api: AirControlApi
  }
}
