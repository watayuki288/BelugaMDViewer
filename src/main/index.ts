import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  shell,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions
} from 'electron'
import { promises as fs, watch, type FSWatcher } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import mime from 'mime-types'
import type { FileTreeNode, OpenFileResult } from '@shared/types'

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx', '.mdown', '.mkd', '.txt'])
const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.ico',
  '.avif'
])

let mainWindow: BrowserWindow | null = null
const pendingOpenPaths: string[] = []
const fileWatchers = new Map<
  string,
  { watcher: FSWatcher; refCount: number; timer?: NodeJS.Timeout }
>()
const recentOwnSaves = new Map<string, number>()

// Authorization registries (normalized real paths) to prevent arbitrary filesystem access from renderer IPC.
const authorizedFiles = new Set<string>()
const authorizedRoots = new Set<string>()
const authorizedImageFiles = new Set<string>()

function normalizeKey(p: string): string {
  const resolved = path.resolve(p)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function hasUnsafePathInput(input: string): boolean {
  if (!input || input.includes('\0')) return true
  // Reject Windows UNC shares (`\\server\share`, `//server/share`) and Win32 device namespaces (`\\?\`, `\\.\`).
  if (/^(\\\\|\/\/)/.test(input)) return true
  return false
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value)
    if (decoded.includes('\0')) return null
    return decoded
  } catch {
    return null
  }
}

function parseSafeLocalFileUrl(rawUrl: string): string | null {
  if (hasUnsafePathInput(rawUrl)) return null
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'file:') return null
    // Reject non-local hosts to prevent Windows UNC paths / outbound SMB & Net-NTLMv2 auth.
    if (parsed.hostname !== '' && parsed.hostname.toLowerCase() !== 'localhost') {
      return null
    }
    const decodedPath = safeDecodeURIComponent(parsed.pathname)
    if (decodedPath === null) return null
    const fsPath = fileURLToPath(parsed)
    if (hasUnsafePathInput(fsPath)) return null
    return path.resolve(fsPath)
  } catch {
    return null
  }
}

function parseSafeExternalUrl(rawUrl: string): string | null {
  if (!rawUrl || rawUrl.includes('\0')) return null
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:') {
      return parsed.href
    }
    return null
  } catch {
    return null
  }
}

async function openSafeExternalUrl(rawUrl: string): Promise<boolean> {
  const safe = parseSafeExternalUrl(rawUrl)
  if (!safe) return false
  await shell.openExternal(safe)
  return true
}

function isPathWithinDirectory(candidatePath: string, directoryPath: string): boolean {
  const rel = path.relative(normalizeKey(directoryPath), normalizeKey(candidatePath))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

async function resolveRealExistingFile(filePath: string): Promise<string | null> {
  if (hasUnsafePathInput(filePath)) return null
  try {
    const resolved = path.resolve(filePath)
    if (hasUnsafePathInput(resolved)) return null
    const real = await fs.realpath(resolved)
    if (hasUnsafePathInput(real)) return null
    const stat = await fs.stat(real)
    return stat.isFile() ? real : null
  } catch {
    return null
  }
}

async function resolveRealExistingDir(dirPath: string): Promise<string | null> {
  if (hasUnsafePathInput(dirPath)) return null
  try {
    const resolved = path.resolve(dirPath)
    if (hasUnsafePathInput(resolved)) return null
    const real = await fs.realpath(resolved)
    if (hasUnsafePathInput(real)) return null
    const stat = await fs.stat(real)
    return stat.isDirectory() ? real : null
  } catch {
    return null
  }
}

function isAuthorizedFilePath(realFilePath: string): boolean {
  const key = normalizeKey(realFilePath)
  if (authorizedFiles.has(key)) return true
  const ext = path.extname(realFilePath).toLowerCase()
  if (!MARKDOWN_EXTENSIONS.has(ext)) return false
  for (const root of authorizedRoots) {
    if (isPathWithinDirectory(realFilePath, root)) {
      return true
    }
  }
  return false
}

function authorizeFile(realFilePath: string): void {
  authorizedFiles.add(normalizeKey(realFilePath))
}

function authorizeRoot(realDirPath: string): void {
  authorizedRoots.add(normalizeKey(realDirPath))
}

function getTrustedRendererUrl(): string {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    return process.env['ELECTRON_RENDERER_URL']
  }
  return pathToFileURL(path.join(__dirname, '../renderer/index.html')).href
}

function isTrustedAppUrl(targetUrl: string): boolean {
  try {
    const trusted = new URL(getTrustedRendererUrl())
    const candidate = new URL(targetUrl)
    if (trusted.protocol === 'file:') {
      return (
        candidate.protocol === 'file:' &&
        normalizeKey(fileURLToPath(candidate)) === normalizeKey(fileURLToPath(trusted))
      )
    }
    return candidate.origin === trusted.origin
  } catch {
    return false
  }
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('Untrusted IPC sender: no active window')
  }
  if (event.sender !== mainWindow.webContents) {
    throw new Error('Untrusted IPC sender: unknown webContents')
  }
  const frame = event.senderFrame
  if (!frame || frame !== mainWindow.webContents.mainFrame || !isTrustedAppUrl(frame.url)) {
    throw new Error('Untrusted IPC sender: invalid frame or origin')
  }
}

function extractMarkdownArgs(argv: string[]): string[] {
  const results: string[] = []
  for (const arg of argv.slice(app.isPackaged ? 1 : 2)) {
    if (!arg || arg.startsWith('-') || hasUnsafePathInput(arg)) continue
    const ext = path.extname(arg).toLowerCase()
    if (MARKDOWN_EXTENSIONS.has(ext)) {
      results.push(path.resolve(arg))
    }
  }
  return results
}

async function readAndAuthorizeMarkdownFile(filePath: string): Promise<OpenFileResult | null> {
  const real = await resolveRealExistingFile(filePath)
  if (!real) return null
  const ext = path.extname(real).toLowerCase()
  if (!MARKDOWN_EXTENSIONS.has(ext)) return null
  try {
    const content = await fs.readFile(real, 'utf8')
    authorizeFile(real)
    return {
      filePath: real,
      content,
      name: path.basename(real)
    }
  } catch {
    return null
  }
}

async function readAuthorizedMarkdownFile(filePath: string): Promise<OpenFileResult | null> {
  const real = await resolveRealExistingFile(filePath)
  if (!real || !isAuthorizedFilePath(real)) return null
  try {
    const content = await fs.readFile(real, 'utf8')
    authorizeFile(real)
    return {
      filePath: real,
      content,
      name: path.basename(real)
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
      } else if (
        entry.isFile() &&
        MARKDOWN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      ) {
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

function unwatchFilePath(filePath: string, force = false): void {
  const key = normalizeKey(filePath)
  const entry = fileWatchers.get(key)
  if (!entry) return
  if (!force && entry.refCount > 1) {
    entry.refCount -= 1
    return
  }
  if (entry.timer) clearTimeout(entry.timer)
  try {
    entry.watcher.close()
  } catch {
    // ignore
  }
  fileWatchers.delete(key)
}

function watchFilePath(realFilePath: string): void {
  const key = normalizeKey(realFilePath)
  const existing = fileWatchers.get(key)
  if (existing) {
    existing.refCount += 1
    return
  }
  try {
    const watcher = watch(realFilePath, { persistent: false }, () => {
      const entry = fileWatchers.get(key)
      if (!entry) return
      if (entry.timer) clearTimeout(entry.timer)
      entry.timer = setTimeout(async () => {
        const lastSave = recentOwnSaves.get(key) ?? 0
        if (Date.now() - lastSave < 800) return
        const file = await readAuthorizedMarkdownFile(realFilePath)
        if (file && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('file:external-changed', {
            filePath: file.filePath,
            content: file.content
          })
        }
      }, 200)
    })
    watcher.on('error', () => unwatchFilePath(realFilePath, true))
    fileWatchers.set(key, { watcher, refCount: 1 })
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
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  // Block popups; open safe http(s)/mailto links in the OS default browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openSafeExternalUrl(url)
    return { action: 'deny' }
  })

  // Lock down top-level navigations and redirects so untrusted content (e.g. SVG links) cannot navigate to external origins with preload APIs attached.
  mainWindow.webContents.on('will-navigate', (event, navUrl) => {
    if (!isTrustedAppUrl(navUrl)) {
      event.preventDefault()
      void openSafeExternalUrl(navUrl)
    }
  })

  mainWindow.webContents.on('will-redirect', (event, navUrl) => {
    if (!isTrustedAppUrl(navUrl)) {
      event.preventDefault()
    }
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
        const files = (await Promise.all(filePaths.map(readAndAuthorizeMarkdownFile))).filter(
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
      unwatchFilePath(key, true)
    }
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}

function registerIpcHandlers(): void {
  ipcMain.handle('file:get-initial', async (event) => {
    assertTrustedSender(event)
    const paths = pendingOpenPaths.splice(0, pendingOpenPaths.length)
    const files = await Promise.all(paths.map(readAndAuthorizeMarkdownFile))
    return files.filter((f): f is OpenFileResult => f !== null)
  })

  ipcMain.handle('file:open-dialog', async (event) => {
    assertTrustedSender(event)
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
    const files = await Promise.all(result.filePaths.map(readAndAuthorizeMarkdownFile))
    return files.filter((f): f is OpenFileResult => f !== null)
  })

  ipcMain.handle('file:open-folder-dialog', async (event) => {
    assertTrustedSender(event)
    const win = mainWindow ?? BrowserWindow.getFocusedWindow()
    const opts: Electron.OpenDialogOptions = {
      title: 'Open Folder',
      properties: ['openDirectory']
    }
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (result.canceled || result.filePaths.length === 0) return null
    const realRoot = await resolveRealExistingDir(result.filePaths[0])
    if (!realRoot) return null
    authorizeRoot(realRoot)
    const tree = await readFolderTree(realRoot)
    return { rootPath: realRoot, tree }
  })

  ipcMain.handle('file:read-folder-tree', async (event, rootPath: string) => {
    assertTrustedSender(event)
    const realRoot = await resolveRealExistingDir(rootPath)
    if (!realRoot || !authorizedRoots.has(normalizeKey(realRoot))) {
      return []
    }
    return readFolderTree(realRoot)
  })

  ipcMain.handle('file:read', async (event, filePath: string) => {
    assertTrustedSender(event)
    return readAuthorizedMarkdownFile(filePath)
  })

  ipcMain.handle('file:open-dropped', async (event, filePath: string) => {
    assertTrustedSender(event)
    return readAndAuthorizeMarkdownFile(filePath)
  })

  ipcMain.handle('file:save', async (event, filePath: string, content: string) => {
    assertTrustedSender(event)
    if (typeof content !== 'string') {
      return { ok: false, error: 'Invalid content' }
    }
    const real = await resolveRealExistingFile(filePath)
    if (!real || !authorizedFiles.has(normalizeKey(real))) {
      return { ok: false, error: 'File is not authorized for direct save' }
    }
    if (!MARKDOWN_EXTENSIONS.has(path.extname(real).toLowerCase())) {
      return { ok: false, error: 'Unsupported file extension' }
    }
    try {
      recentOwnSaves.set(normalizeKey(real), Date.now())
      await fs.writeFile(real, content, 'utf8')
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('file:save-as-dialog', async (event, defaultName: string, content: string) => {
    assertTrustedSender(event)
    if (typeof content !== 'string') return null
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
    if (result.canceled || !result.filePath || hasUnsafePathInput(result.filePath)) return null
    const resolved = path.resolve(result.filePath)
    recentOwnSaves.set(normalizeKey(resolved), Date.now())
    await fs.writeFile(resolved, content, 'utf8')
    const real = (await resolveRealExistingFile(resolved)) ?? resolved
    authorizeFile(real)
    return { filePath: real, name: path.basename(real) }
  })

  ipcMain.handle('file:pick-image-dialog', async (event, baseFilePath?: string) => {
    assertTrustedSender(event)
    const win = mainWindow ?? BrowserWindow.getFocusedWindow()
    const opts: Electron.OpenDialogOptions = {
      title: 'Insert Image',
      defaultPath:
        baseFilePath && !hasUnsafePathInput(baseFilePath) ? path.dirname(baseFilePath) : undefined,
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'] }
      ]
    }
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (result.canceled || result.filePaths.length === 0) return null
    const realChosen = await resolveRealExistingFile(result.filePaths[0])
    if (!realChosen) return null
    authorizedImageFiles.add(normalizeKey(realChosen))
    if (baseFilePath && !hasUnsafePathInput(baseFilePath)) {
      const rel = path.relative(path.dirname(baseFilePath), realChosen).replace(/\\/g, '/')
      if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
        return `./${rel}`
      }
      return rel
    }
    return realChosen
  })

  ipcMain.handle('file:read-local-image', async (event, src: string, baseFilePath?: string) => {
    assertTrustedSender(event)
    try {
      if (!src || hasUnsafePathInput(src)) return null
      if (/^(https?:|data:image\/|blob:)/i.test(src)) return src

      const realBase = baseFilePath ? await resolveRealExistingFile(baseFilePath) : null
      if (realBase && !isAuthorizedFilePath(realBase)) return null
      const baseDir = realBase ? path.dirname(realBase) : null

      let candidate: string | null = null
      if (/^file:/i.test(src)) {
        candidate = parseSafeLocalFileUrl(src)
      } else {
        const decoded = safeDecodeURIComponent(src.split(/[?#]/)[0])
        if (!decoded || hasUnsafePathInput(decoded)) return null
        if (path.isAbsolute(decoded)) {
          candidate = path.resolve(decoded)
        } else if (baseDir) {
          candidate = path.resolve(baseDir, decoded)
        }
      }
      if (!candidate || hasUnsafePathInput(candidate)) return null

      const realTarget = await resolveRealExistingFile(candidate)
      if (!realTarget) return null

      const ext = path.extname(realTarget).toLowerCase()
      if (!IMAGE_EXTENSIONS.has(ext)) return null

      // Enforce boundary: image must be explicitly picked by user, or inside the document's directory / an authorized folder root.
      const isExplicitlyPicked = authorizedImageFiles.has(normalizeKey(realTarget))
      const isInDocDir = baseDir ? isPathWithinDirectory(realTarget, baseDir) : false
      let isInAuthorizedRoot = false
      for (const root of authorizedRoots) {
        if (isPathWithinDirectory(realTarget, root)) {
          isInAuthorizedRoot = true
          break
        }
      }
      if (!isExplicitlyPicked && !isInDocDir && !isInAuthorizedRoot) {
        return null
      }

      const stat = await fs.stat(realTarget)
      if (!stat.isFile() || stat.size > 30 * 1024 * 1024) return null
      const buf = await fs.readFile(realTarget)
      const mimeType = mime.lookup(ext) || 'application/octet-stream'
      return `data:${mimeType};base64,${buf.toString('base64')}`
    } catch {
      return null
    }
  })

  ipcMain.handle('file:resolve-relative', async (event, href: string, baseFilePath?: string) => {
    assertTrustedSender(event)
    try {
      if (!href || !baseFilePath || hasUnsafePathInput(href) || hasUnsafePathInput(baseFilePath)) {
        return null
      }
      const realBase = await resolveRealExistingFile(baseFilePath)
      if (!realBase || !isAuthorizedFilePath(realBase)) return null
      const baseDir = path.dirname(realBase)

      let candidate: string | null = null
      if (/^file:/i.test(href)) {
        candidate = parseSafeLocalFileUrl(href)
      } else {
        const decoded = safeDecodeURIComponent(href.split(/[?#]/)[0])
        if (!decoded || hasUnsafePathInput(decoded)) return null
        candidate = path.isAbsolute(decoded)
          ? path.resolve(decoded)
          : path.resolve(baseDir, decoded)
      }
      if (!candidate || hasUnsafePathInput(candidate)) return null

      const realTarget = await resolveRealExistingFile(candidate)
      if (!realTarget) return null
      if (!MARKDOWN_EXTENSIONS.has(path.extname(realTarget).toLowerCase())) return null

      const isInDocDir = isPathWithinDirectory(realTarget, baseDir)
      let isInAuthorizedRoot = false
      for (const root of authorizedRoots) {
        if (isPathWithinDirectory(realTarget, root)) {
          isInAuthorizedRoot = true
          break
        }
      }
      if (!isInDocDir && !isInAuthorizedRoot) return null

      authorizeFile(realTarget)
      return realTarget
    } catch {
      return null
    }
  })

  ipcMain.handle('file:watch', async (event, filePath: string) => {
    assertTrustedSender(event)
    const real = await resolveRealExistingFile(filePath)
    if (!real || !isAuthorizedFilePath(real)) return
    watchFilePath(real)
  })

  ipcMain.handle('file:unwatch', (event, filePath: string) => {
    assertTrustedSender(event)
    if (hasUnsafePathInput(filePath)) return
    unwatchFilePath(filePath)
  })

  ipcMain.handle('app:open-external', async (event, url: string) => {
    assertTrustedSender(event)
    // Strictly allow only http(s) and mailto; never invoke shell.openPath on document-supplied links.
    await openSafeExternalUrl(url)
  })

  ipcMain.handle('app:write-clipboard', (event, text: string) => {
    assertTrustedSender(event)
    if (typeof text !== 'string') return
    clipboard.writeText(text)
  })
}
