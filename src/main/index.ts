import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { mouse, keyboard, Key, Button } from '@nut-tree-fork/nut-js'
import icon from '../../resources/icon.png?asset'

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
    shell.openExternal(details.url)
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
    } catch (error) {
      console.error('[ipc cursor:mouseDown] failed', error)
    }
  })

  ipcMain.handle('cursor:mouseUp', async () => {
    try {
      await mouse.releaseButton(Button.LEFT)
    } catch (error) {
      console.error('[ipc cursor:mouseUp] failed', error)
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
      const resolvedKeys = keys
        .map((k) => keyMap[k])
        .filter((k): k is Key => k !== undefined)

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
