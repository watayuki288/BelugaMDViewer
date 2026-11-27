import { contextBridge, ipcRenderer } from 'electron'
import type { OpenFileResult, OrcaMdApi } from '@shared/types'

const api: OrcaMdApi = {
  openFileDialog: () => ipcRenderer.invoke('file:open-dialog'),
  openFolderDialog: () => ipcRenderer.invoke('file:open-folder-dialog'),
  readFolderTree: (rootPath) => ipcRenderer.invoke('file:read-folder-tree', rootPath),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('file:save', filePath, content),
  saveFileAsDialog: (defaultName, content) =>
    ipcRenderer.invoke('file:save-as-dialog', defaultName, content),
  pickImageDialog: (baseFilePath) => ipcRenderer.invoke('file:pick-image-dialog', baseFilePath),
  readLocalImage: (src, baseFilePath) =>
    ipcRenderer.invoke('file:read-local-image', src, baseFilePath),
  resolveRelativePath: (href, baseFilePath) =>
    ipcRenderer.invoke('file:resolve-relative', href, baseFilePath),
  watchFile: (filePath) => ipcRenderer.invoke('file:watch', filePath),
  unwatchFile: (filePath) => ipcRenderer.invoke('file:unwatch', filePath),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  writeClipboardText: (text) => ipcRenderer.invoke('app:write-clipboard', text),
  getInitialFiles: () => ipcRenderer.invoke('file:get-initial'),
  onExternalFileChanged: (cb) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { filePath: string; content: string }
    ): void => cb(payload)
    ipcRenderer.on('file:external-changed', listener)
    return () => ipcRenderer.removeListener('file:external-changed', listener)
  },
  onOpenFilesFromOs: (cb) => {
    const listener = (_event: Electron.IpcRendererEvent, files: OpenFileResult[]): void => cb(files)
    ipcRenderer.on('app:open-files', listener)
    return () => ipcRenderer.removeListener('app:open-files', listener)
  },
  onMenuAction: (cb) => {
    const listener = (_event: Electron.IpcRendererEvent, action: string): void => cb(action)
    ipcRenderer.on('app:menu-action', listener)
    return () => ipcRenderer.removeListener('app:menu-action', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
