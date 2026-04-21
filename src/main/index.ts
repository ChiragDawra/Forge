import { app, BrowserWindow, dialog, session, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { closeDb, initDb } from './db/client'
import { registerSettingsIpc } from './ipc/settings'
import { registerProjectsIpc } from './ipc/projects'
import { registerAiIpc } from './ipc/ai'
import { registerToolsIpc } from './ipc/tools'
import { registerAgentIpc } from './ipc/agent'
import { initAiClients } from './ai/init'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      enableBlinkFeatures: ''
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Security: open external links in default browser, never inside the app
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.chirag.forge')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  try {
    initDb(app.getPath('userData'))
  } catch (err) {
    console.error('[Forge] DB init failed:', err)
    const errorMessage = is.dev
      ? `${err instanceof Error ? err.message : String(err)}`
      : 'Please reinstall or contact support.'
    dialog.showErrorBox('Forge — Database Error', `Failed to initialize the local database.\n\n${errorMessage}`)
    app.exit(1)
    return
  }

  // Security headers — production-only CSP (Vite HMR needs relaxed policy in dev)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers: Record<string, string[]> = {
      ...details.responseHeaders,
      'X-Content-Type-Options': ['nosniff'],
      'X-Frame-Options': ['DENY'],
      'Referrer-Policy': ['no-referrer'],
      'X-XSS-Protection': ['1; mode=block']
    }

    if (!is.dev) {
      headers['Content-Security-Policy'] = [
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'"
      ]
    }

    callback({ responseHeaders: headers })
  })

  // Security: block navigation to external URLs
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, url) => {
      const parsed = new URL(url)
      if (is.dev && parsed.origin === 'http://localhost:5173') return
      if (!is.dev && parsed.protocol === 'file:') return
      event.preventDefault()
    })

    // Security: block new window creation (popups)
    contents.setWindowOpenHandler(() => {
      return { action: 'deny' }
    })

    // Security: block webview/iframe attachment
    contents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })
  })

  // Security: disable permission requests (camera, microphone, geolocation, etc.)
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  registerSettingsIpc()
  registerProjectsIpc()
  registerAiIpc()
  registerToolsIpc()
  registerAgentIpc()

  // Initialise AI clients from keychain (non-blocking — missing keys are ok)
  initAiClients().catch((err) => {
    console.warn('[AI] Client init warning:', err instanceof Error ? err.message : err)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeDb()
})
