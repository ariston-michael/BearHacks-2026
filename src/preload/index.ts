import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  ipcRenderer: {
    send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void =>
        listener(...args)
      ipcRenderer.on(channel, subscription)
      return () => ipcRenderer.removeListener(channel, subscription)
    },
    invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  },
  cursor: {
    move: (x: number, y: number) => ipcRenderer.invoke('cursor:move', x, y),
    click: () => ipcRenderer.invoke('cursor:click'),
    rightClick: () => ipcRenderer.invoke('cursor:rightClick'),
    scroll: (deltaY: number) => ipcRenderer.invoke('cursor:scroll', deltaY),
    mouseDown: () => ipcRenderer.invoke('cursor:mouseDown'),
    mouseUp: () => ipcRenderer.invoke('cursor:mouseUp')
  },
  keyboard: {
    shortcut: (keys: string[]) => ipcRenderer.invoke('keyboard:shortcut', keys)
  },
  process: {
    platform: process.platform,
    versions: process.versions
  }
}

const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
