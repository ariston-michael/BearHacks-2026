import { ElectronAPI } from '@electron-toolkit/preload'

interface CursorAPI {
  move: (x: number, y: number) => Promise<void>
  click: () => Promise<void>
  rightClick: () => Promise<void>
  scroll: (deltaY: number) => Promise<void>
  mouseDown: () => Promise<void>
  mouseUp: () => Promise<void>
}

interface KeyboardAPI {
  shortcut: (keys: string[]) => Promise<void>
}

type AppElectronAPI = ElectronAPI & {
  cursor: CursorAPI
  keyboard: KeyboardAPI
}

declare global {
  interface Window {
    electron: AppElectronAPI
    api: unknown
  }
}
