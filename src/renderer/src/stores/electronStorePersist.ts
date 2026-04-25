// Custom Zustand middleware that persists store state through Electron IPC,
// targeting an electron-store-backed handler in the main process.
//
// Expected main-process IPC channels (to be implemented by the main-process owner):
//   - 'settings:get' (key: string) => unknown
//   - 'settings:set' (key: string, value: unknown) => void
//
// If the IPC bridge is not available (e.g. running in a plain browser dev shell),
// the middleware degrades to an in-memory store with a single warning log.

import type { StateCreator, StoreApi } from 'zustand'

export interface ElectronStorePersistOptions<T> {
  key: string
  partialize?: (_state: T) => Partial<T>
  debounceMs?: number
}

interface IpcRendererBridge {
  invoke: (_channel: string, ..._args: unknown[]) => Promise<unknown>
}

function getIpcRenderer(): IpcRendererBridge | null {
  if (typeof window === 'undefined') {
    return null
  }
  const _maybeElectron = (window as unknown as { electron?: { ipcRenderer?: IpcRendererBridge } })
    .electron
  return _maybeElectron?.ipcRenderer ?? null
}

let m_warnedMissingBridge = false

function warnMissingBridgeOnce(): void {
  if (m_warnedMissingBridge) {
    return
  }
  m_warnedMissingBridge = true
  console.warn(
    '[electronStorePersist] window.electron.ipcRenderer not found; persistence disabled.'
  )
}

export function electronStorePersist<T extends object>(
  _config: StateCreator<T, [], [], T>,
  _options: ElectronStorePersistOptions<T>
): StateCreator<T, [], [], T> {
  const m_debounceMs = _options.debounceMs ?? 150

  return (_set, _get, _api) => {
    let m_writeTimer: ReturnType<typeof setTimeout> | null = null

    const flushWrite = (): void => {
      const _ipc = getIpcRenderer()
      if (!_ipc) {
        return
      }
      const _state = _get()
      const _payload = _options.partialize ? _options.partialize(_state) : _state
      _ipc.invoke('settings:set', _options.key, _payload).catch((_err) => {
        console.error('[electronStorePersist] settings:set failed', _err)
      })
    }

    const scheduleWrite = (): void => {
      if (m_writeTimer) {
        clearTimeout(m_writeTimer)
      }
      m_writeTimer = setTimeout(flushWrite, m_debounceMs)
    }

    const wrappedSet: StoreApi<T>['setState'] = (_partial, _replace) => {
      ;(_set as StoreApi<T>['setState'])(
        _partial as Parameters<StoreApi<T>['setState']>[0],
        _replace as Parameters<StoreApi<T>['setState']>[1]
      )
      scheduleWrite()
    }

    const _initialState = _config(wrappedSet, _get, _api)

    const _ipc = getIpcRenderer()
    if (!_ipc) {
      warnMissingBridgeOnce()
      return _initialState
    }

    _ipc
      .invoke('settings:get', _options.key)
      .then((_loaded) => {
        if (_loaded && typeof _loaded === 'object') {
          ;(_set as StoreApi<T>['setState'])(_loaded as Partial<T>, false)
        }
      })
      .catch((_err) => {
        console.error('[electronStorePersist] settings:get failed', _err)
      })

    return _initialState
  }
}
