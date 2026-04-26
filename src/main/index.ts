import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { mouse, keyboard, Key } from '@nut-tree-fork/nut-js'
import icon from '../../resources/icon.png?asset'
import type { VoiceExecuteIntentPayload, VoiceExecuteIntentResult } from '../shared/voiceIpc'
import { resolveAndLaunch } from './voiceCommands'
import { warmAppCacheWhenReady } from './appDiscovery'

const ALLOWED: readonly VoiceExecuteIntentPayload['action'][] = [
  'open_app',
  'open_url',
  'open_app_with_query',
  'search_web',
  'select_link',
  'page_question',
  'spotify_search',
  'spotify_select',
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
  if (_o['url'] !== undefined && typeof _o['url'] !== 'string') {
    return false
  }
  if (_o['linkIndex'] !== undefined && typeof _o['linkIndex'] !== 'number') {
    return false
  }
  if (_o['linkText'] !== undefined && typeof _o['linkText'] !== 'string') {
    return false
  }
  if (_o['anchorText'] !== undefined && typeof _o['anchorText'] !== 'string') {
    return false
  }
  if (_o['targetIndex'] !== undefined && typeof _o['targetIndex'] !== 'number') {
    return false
  }
  if (_o['targetText'] !== undefined && typeof _o['targetText'] !== 'string') {
    return false
  }
  if (_o['targetKind'] !== undefined && typeof _o['targetKind'] !== 'string') {
    return false
  }
  return true
}

warmAppCacheWhenReady()

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
      const _validPayload = isPayload(_raw)
      if (!_validPayload) {
        return { ok: false, message: 'Invalid voice payload' }
      }
      return resolveAndLaunch(_raw)
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
