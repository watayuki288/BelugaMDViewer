import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  shell,
  type MenuItemConstructorOptions
} from 'electron'
import { promises as fs, watch, type FSWatcher } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mime from 'mime-types'
import type { FileTreeNode, OpenFileResult } from '@shared/types'

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx', '.mdown', '.mkd', '.txt'])
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif'])

let mainWindow: BrowserWindow | null = null
const pendingOpenPaths: string[] = []
const fileWatchers = new Map<string, { watcher: FSWatcher; timer?: NodeJS.Timeout }>()
const recentOwnSaves = new Map<string, number>()

function extractMarkdownArgs(argv: string[]): string[] {
  const results: string[] = []
  for (const arg of argv.slice(app.isPackaged ? 1 : 2)) {
    if (!arg || arg.startsWith('-')) continue
    const ext = path.extname(arg).toLowerCase()
    if (MARKDOWN_EXTENSIONS.has(ext)) {
      results.push(path.resolve(arg))
    }
  }
  return results
}

async function readMarkdownFile(filePath: string): Promise<OpenFileResult | null> {
  try {
    const resolved = path.resolve(filePath)
    const stat = await fs.stat(resolved)
    if (!stat.isFile()) return null
    const content = await fs.readFile(resolved, 'utf8')
    return {
      filePath: resolved,
      content,
      name: path.basename(resolved)
    }
  } catch {
    return null
  }
}

async function readFolderTree(dirPath: string, depth = 0): Promise<FileTreeNode[]> {
  if (depth > 6) return []
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const nodes: FileTreeNode[] = []
    for (const entry of entries) {
      if (
        entry.name.startsWith('.') ||
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'out'
      ) {
        continue
      }
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        const children = await readFolderTree(fullPath, depth + 1)
        if (children.length > 0) {
          nodes.push({
            name: entry.name,
            path: fullPath,
            isDirectory: true,
            children
          })
        }
      } else if (entry.isFile() && MARKDOWN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        nodes.push({
          name: entry.name,
          path: fullPath,
          isDirectory: false
        })
      }
    }
    nodes.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    })
    return nodes
  } catch {
    return []
  }
}

function unwatchFilePath(filePath: string): void {
  const key = path.resolve(filePath)
  const entry = fileWatchers.get(key)
  if (!entry) return
  if (entry.timer) clearTimeout(entry.timer)
  try {
    entry.watcher.close()
  } catch {
    // ignore
  }
  fileWatchers.delete(key)
}

function watchFilePath(filePath: string): void {
  const key = path.resolve(filePath)
  if (fileWatchers.has(key)) return
  try {
    const watcher = watch(key, { persistent: false }, () => {
      const entry = fileWatchers.get(key)
      if (!entry) return
      if (entry.timer) clearTimeout(entry.timer)
      entry.timer = setTimeout(async () => {
        const lastSave = recentOwnSaves.get(key) ?? 0
        if (Date.now() - lastSave < 800) return
        const file = await readMarkdownFile(key)
        if (file && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('file:external-changed', {
            filePath: file.filePath,
            content: file.content
          })
        }
      }, 200)
    })
    watcher.on('error', () => unwatchFilePath(key))
    fileWatchers.set(key, { watcher })
  } catch {
    // ignore watch failure
  }
}

function sendMenuAction(action: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:menu-action', action)
  }
}

function buildAppMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New Document', accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction('new') },
        { label: 'Open File...', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('open') },
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendMenuAction('open-folder')
        },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendMenuAction('save') },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuAction('save-as')
        },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => sendMenuAction('close-tab') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => sendMenuAction('undo') },
        {
          label: 'Redo',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+Z' : 'Ctrl+Y',
          click: () => sendMenuAction('redo')
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find', accelerator: 'CmdOrCtrl+F', click: () => sendMenuAction('find') }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Rich Edit / Preview',
          accelerator: 'CmdOrCtrl+Shift+V',
          click: () => sendMenuAction('toggle-mode')
        },
        {
          label: 'Toggle Table of Contents',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => sendMenuAction('toggle-toc')
        },
        {
          label: 'Toggle Folder Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => sendMenuAction('toggle-sidebar')
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => sendMenuAction('zoom-in')
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => sendMenuAction('zoom-out')
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => sendMenuAction('zoom-reset')
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 760,
    minHeight: 520,
    title: 'BelugaMDViewer',
    backgroundColor: '#1e1e1e',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  pendingOpenPaths.push(...extractMarkdownArgs(process.argv))

  app.on('second-instance', async (_event, argv) => {
    const filePaths = extractMarkdownArgs(argv)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      if (filePaths.length > 0) {
        const files = (await Promise.all(filePaths.map(readMarkdownFile))).filter(
          (f): f is OpenFileResult => f !== null
        )
        if (files.length > 0) {
          mainWindow.webContents.send('app:open-files', files)
        }
      }
    }
  })

  app.whenReady().then(() => {
    buildAppMenu()
    registerIpcHandlers()
    createWindow()
  })

  app.on('window-all-closed', () => {
    for (const key of [...fileWatchers.keys()]) {
      unwatchFilePath(key)
    }
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}

function registerIpcHandlers(): void {
  ipcMain.handle('file:get-initial', async () => {
    const paths = pendingOpenPaths.splice(0, pendingOpenPaths.length)
    const files = await Promise.all(paths.map(readMarkdownFile))
    return files.filter((f): f is OpenFileResult => f !== null)
  })

  ipcMain.handle('file:open-dialog', async () => {
    const win = mainWindow ?? BrowserWindow.getFocusedWindow()
    const opts: Electron.OpenDialogOptions = {
      title: 'Open Markdown File',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Markdown Files', extensions: ['md', 'markdown', 'mdx', 'mdown', 'mkd', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    }
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (result.canceled || result.filePaths.length === 0) return []
    const files = await Promise.all(result.filePaths.map(readMarkdownFile))
    return files.filter((f): f is OpenFileResult => f !== null)
  })

  ipcMain.handle('file:open-folder-dialog', async () => {
    const win = mainWindow ?? BrowserWindow.getFocusedWindow()
    const opts: Electron.OpenDialogOptions = {
      title: 'Open Folder',
      properties: ['openDirectory']
    }
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (result.canceled || result.filePaths.length === 0) return null
    const rootPath = result.filePaths[0]
    const tree = await readFolderTree(rootPath)
    return { rootPath, tree }
  })

  ipcMain.handle('file:read-folder-tree', async (_event, rootPath: string) => {
    return readFolderTree(rootPath)
  })

  ipcMain.handle('file:read', async (_event, filePath: string) => {
    return readMarkdownFile(filePath)
  })

  ipcMain.handle('file:save', async (_event, filePath: string, content: string) => {
    try {
      const resolved = path.resolve(filePath)
      recentOwnSaves.set(resolved, Date.now())
      await fs.writeFile(resolved, content, 'utf8')
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('file:save-as-dialog', async (_event, defaultName: string, content: string) => {
    const win = mainWindow ?? BrowserWindow.getFocusedWindow()
    const opts: Electron.SaveDialogOptions = {
      title: 'Save Markdown File',
      defaultPath: defaultName || 'Untitled.md',
      filters: [
        { name: 'Markdown Files', extensions: ['md', 'markdown'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    }
    const result = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (result.canceled || !result.filePath) return null
    const resolved = path.resolve(result.filePath)
    recentOwnSaves.set(resolved, Date.now())
    await fs.writeFile(resolved, content, 'utf8')
    return { filePath: resolved, name: path.basename(resolved) }
  })

  ipcMain.handle('file:pick-image-dialog', async (_event, baseFilePath?: string) => {
    const win = mainWindow ?? BrowserWindow.getFocusedWindow()
    const opts: Electron.OpenDialogOptions = {
      title: 'Insert Image',
      defaultPath: baseFilePath ? path.dirname(baseFilePath) : undefined,
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'] }
      ]
    }
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (result.canceled || result.filePaths.length === 0) return null
    const chosen = result.filePaths[0]
    if (baseFilePath) {
      const rel = path.relative(path.dirname(baseFilePath), chosen).replace(/\\/g, '/')
      if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
        return `./${rel}`
      }
      return rel
    }
    return chosen
  })

  ipcMain.handle('file:read-local-image', async (_event, src: string, baseFilePath?: string) => {
    try {
      if (!src) return null
      if (/^(https?:|data:|blob:)/i.test(src)) return src
      let resolved: string
      if (src.startsWith('file://')) {
        resolved = fileURLToPath(src)
      } else {
        const cleanSrc = decodeURIComponent(src.split(/[?#]/)[0])
        if (path.isAbsolute(cleanSrc)) {
          resolved = cleanSrc
        } else if (baseFilePath) {
          resolved = path.resolve(path.dirname(baseFilePath), cleanSrc)
        } else {
          return null
        }
      }
      const ext = path.extname(resolved).toLowerCase()
      if (!IMAGE_EXTENSIONS.has(ext)) return null
      const stat = await fs.stat(resolved)
      if (!stat.isFile() || stat.size > 30 * 1024 * 1024) return null
      const buf = await fs.readFile(resolved)
      const mimeType = mime.lookup(ext) || 'application/octet-stream'
      return `data:${mimeType};base64,${buf.toString('base64')}`
    } catch {
      return null
    }
  })

  ipcMain.handle('file:resolve-relative', async (_event, href: string, baseFilePath?: string) => {
    try {
      if (!href || !baseFilePath) return null
      const cleanHref = decodeURIComponent(href.split(/[?#]/)[0])
      const resolved = path.isAbsolute(cleanHref)
        ? cleanHref
        : path.resolve(path.dirname(baseFilePath), cleanHref)
      const stat = await fs.stat(resolved)
      return stat.isFile() ? resolved : null
    } catch {
      return null
    }
  })

  ipcMain.handle('file:watch', (_event, filePath: string) => {
    watchFilePath(filePath)
  })

  ipcMain.handle('file:unwatch', (_event, filePath: string) => {
    unwatchFilePath(filePath)
  })

  ipcMain.handle('app:open-external', async (_event, url: string) => {
    if (/^(https?:|mailto:)/i.test(url)) {
      await shell.openExternal(url)
    } else if (url.startsWith('file://')) {
      await shell.openPath(fileURLToPath(url))
    }
  })

  ipcMain.handle('app:write-clipboard', (_event, text: string) => {
    clipboard.writeText(text)
  })
}
