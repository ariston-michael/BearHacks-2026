import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { mouse, keyboard, Key } from '@nut-tree-fork/nut-js'
import icon from '../../resources/icon.png?asset'
import type { VoiceExecuteIntentPayload, VoiceExecuteIntentResult } from '../shared/voiceIpc'

const execFileAsync = promisify(execFile)

const ALLOWED: readonly VoiceExecuteIntentPayload['action'][] = [
  'open_app',
  'search_web',
  'scroll_up',
  'scroll_down',
  'click',
  'unknown'
]

function isPayload(_value: unknown): _value is VoiceExecuteIntentPayload {
  if (_value === null || typeof _value !== 'object') {
    return false
  }
  const _o = _value as Record<string, unknown>
  if (typeof _o['action'] !== 'string' || !ALLOWED.includes(_o['action'] as never)) {
    return false
  }
  if (typeof _o['confidence'] !== 'number' || _o['confidence'] < 0 || _o['confidence'] > 1) {
    return false
  }
  if (_o['query'] !== undefined && typeof _o['query'] !== 'string') {
    return false
  }
  if (_o['appName'] !== undefined && typeof _o['appName'] !== 'string') {
    return false
  }
  return true
}

async function launchAppByName(_name: string): Promise<string> {
  const _key = _name.toLowerCase().trim()
  if (process.platform === 'win32') {
    const _map: Record<string, string> = {
      notepad: 'notepad',
      calculator: 'calc',
      calc: 'calc',
      paint: 'mspaint',
      mspaint: 'mspaint'
    }
    const _cmd = _map[_key]
    if (!_cmd) {
      throw new Error(
        `Unknown app "${_name}" — add it to the allowlist in main (win32) or use a known name: notepad, calculator, paint`
      )
    }
    await execFileAsync(_cmd, [], { windowsHide: true })
    return _cmd
  }
  if (process.platform === 'darwin') {
    const _map: Record<string, string> = {
      notepad: 'TextEdit',
      textedit: 'TextEdit',
      calculator: 'Calculator',
      calc: 'Calculator',
      paint: 'Preview'
    }
    const _app = _map[_key]
    if (!_app) {
      throw new Error(
        `Unknown app "${_name}" — add it to the allowlist in main (darwin) or use: notepad, calculator`
      )
    }
    await execFileAsync('open', ['-a', _app])
    return _app
  }
  throw new Error('open_app is only configured for Windows and macOS')
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.electron')
  }

  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle(
    'voice:executeIntent',
    async (_event, _raw: unknown): Promise<VoiceExecuteIntentResult> => {
      if (!isPayload(_raw)) {
        return { ok: false, message: 'Invalid voice payload' }
      }
      const _p = _raw
      try {
        if (_p['action'] === 'search_web') {
          const _q = (_p['query'] ?? '').trim()
          if (_q.length === 0) {
            return { ok: false, message: 'search_web requires non-empty query' }
          }
          const _url = `https://www.google.com/search?q=${encodeURIComponent(_q)}`
          await shell.openExternal(_url)
          return { ok: true, message: `Opened search: ${_q}` }
        }
        if (_p['action'] === 'open_app') {
          const _name = (_p['appName'] ?? '').trim()
          if (_name.length === 0) {
            return { ok: false, message: 'open_app requires appName' }
          }
          const _launched = await launchAppByName(_name)
          return { ok: true, message: `Launched: ${_launched}` }
        }
        return { ok: false, message: 'This action is handled in the renderer' }
      } catch (_err) {
        const _message = _err instanceof Error ? _err.message : String(_err)
        return { ok: false, message: _message }
      }
    }
  )

  ipcMain.handle('cursor:move', async (_event, x: number, y: number) => {
    try {
      await mouse.setPosition({ x, y })
    } catch (error) {
      console.error('[ipc cursor:move] failed', error)
    }
  })

  ipcMain.handle('cursor:click', async () => {
    try {
      await mouse.leftClick()
    } catch (error) {
      console.error('[ipc cursor:click] failed', error)
    }
  })

  ipcMain.handle('cursor:rightClick', async () => {
    try {
      await mouse.rightClick()
    } catch (error) {
      console.error('[ipc cursor:rightClick] failed', error)
    }
  })

  ipcMain.handle('cursor:scroll', async (_event, deltaY: number) => {
    try {
      const amount = Math.abs(deltaY)
      if (amount === 0) {
        return
      }

      if (deltaY > 0) {
        await mouse.scrollDown(amount)
      } else {
        await mouse.scrollUp(amount)
      }
    } catch (error) {
      console.error('[ipc cursor:scroll] failed', error)
    }
  })

  ipcMain.handle('keyboard:shortcut', async (_event, keys: string[]) => {
    try {
      const keyMap = Key as unknown as Record<string, Key>
      const resolvedKeys = keys.map((k) => keyMap[k]).filter((k): k is Key => k !== undefined)

      if (resolvedKeys.length === 0) {
        console.warn('[ipc keyboard:shortcut] no valid keys provided', keys)
        return
      }

      await keyboard.pressKey(...resolvedKeys)
      await keyboard.releaseKey(...resolvedKeys)
    } catch (error) {
      console.error('[ipc keyboard:shortcut] failed', error)
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
