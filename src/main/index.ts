import { app, shell, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { mouse, keyboard, Key, Button } from '@nut-tree-fork/nut-js'
import icon from '../../resources/icon.png?asset'
import type { VoiceExecuteIntentPayload, VoiceExecuteIntentResult } from '../shared/voiceIpc'
import { resolveAndLaunch } from './voiceCommands'
import { warmAppCacheWhenReady } from './appDiscovery'

// electron-store v11 is ESM-only; dynamically import so the CJS main bundle can load it.
type StoreType = import('electron-store').default<Record<string, unknown>>
let store: StoreType | null = null

async function getStore(): Promise<StoreType> {
  if (store) return store
  const { default: Store } = await import('electron-store')
  store = new Store<Record<string, unknown>>()
  return store
}

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
      sandbox: false,
      backgroundThrottling: false
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

  ipcMain.handle('cursor:mouseDown', async () => {
    try {
      await mouse.pressButton(Button.LEFT)
    } catch (err) {
      console.error('[ipc cursor:mouseDown] failed', err)
    }
  })

  ipcMain.handle('cursor:mouseUp', async () => {
    try {
      await mouse.releaseButton(Button.LEFT)
    } catch (err) {
      console.error('[ipc cursor:mouseUp] failed', err)
    }
  })

  ipcMain.handle('cursor:middleDown', async () => {
    try {
      await mouse.pressButton(Button.MIDDLE)
    } catch (err) {
      console.error('[ipc cursor:middleDown] failed', err)
    }
  })

  ipcMain.handle('cursor:middleUp', async () => {
    try {
      await mouse.releaseButton(Button.MIDDLE)
    } catch (err) {
      console.error('[ipc cursor:middleUp] failed', err)
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

  ipcMain.handle('display:getActiveMetrics', () => {
    const point = screen.getCursorScreenPoint()
    const activeDisplay = screen.getDisplayNearestPoint(point)
    return {
      width: activeDisplay.size.width,
      height: activeDisplay.size.height,
      scaleFactor: activeDisplay.scaleFactor
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

  // ── Settings: Launch at login ──────────────────────────────────────────────
  ipcMain.handle('settings:getStartup', () => {
    return app.getLoginItemSettings().openAtLogin
  })

  ipcMain.handle('settings:setStartup', (_event, openAtLogin: boolean) => {
    app.setLoginItemSettings({ openAtLogin })
  })

  // ── Settings: Secure API key storage (main-process electron-store) ─────────
  ipcMain.handle('settings:getApiKey', async (_event, service: string) => {
    const s = await getStore()
    return s.get(`apiKeys.${service}`, '') as string
  })

  ipcMain.handle('settings:setApiKey', async (_event, service: string, key: string) => {
    const s = await getStore()
    s.set(`apiKeys.${service}`, key)
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
