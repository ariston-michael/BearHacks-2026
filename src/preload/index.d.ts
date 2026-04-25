import { ElectronAPI } from '@electron-toolkit/preload'
import type { VoiceExecuteIntentPayload, VoiceExecuteIntentResult } from '../shared/voiceIpc'

interface CursorAPI {
  move: (x: number, y: number) => Promise<void>
  click: () => Promise<void>
  rightClick: () => Promise<void>
  scroll: (deltaY: number) => Promise<void>
}

interface KeyboardAPI {
  shortcut: (keys: string[]) => Promise<void>
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
}

declare global {
  interface Window {
    electron: AppElectronAPI
    api: AirControlApi
  }
}
