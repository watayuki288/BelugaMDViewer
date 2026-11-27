export type ViewMode = 'rich' | 'preview'
export type ThemePreference = 'system' | 'light' | 'dark'

export interface OpenFileResult {
  filePath: string
  content: string
  name: string
}

export interface FileTreeNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileTreeNode[]
}

export interface OrcaMdApi {
  openFileDialog: () => Promise<OpenFileResult[]>
  openFolderDialog: () => Promise<{ rootPath: string; tree: FileTreeNode[] } | null>
  readFolderTree: (rootPath: string) => Promise<FileTreeNode[]>
  readFile: (filePath: string) => Promise<OpenFileResult | null>
  openDroppedFile: (file: File) => Promise<OpenFileResult | null>
  saveFile: (filePath: string, content: string) => Promise<{ ok: boolean; error?: string }>
  saveFileAsDialog: (
    defaultName: string,
    content: string
  ) => Promise<{ filePath: string; name: string } | null>
  pickImageDialog: (baseFilePath?: string) => Promise<string | null>
  readLocalImage: (src: string, baseFilePath?: string) => Promise<string | null>
  resolveRelativePath: (href: string, baseFilePath?: string) => Promise<string | null>
  watchFile: (filePath: string) => Promise<void>
  unwatchFile: (filePath: string) => Promise<void>
  openExternal: (url: string) => Promise<void>
  writeClipboardText: (text: string) => Promise<void>
  getInitialFiles: () => Promise<OpenFileResult[]>
  onExternalFileChanged: (cb: (payload: { filePath: string; content: string }) => void) => () => void
  onOpenFilesFromOs: (cb: (files: OpenFileResult[]) => void) => () => void
  onMenuAction: (cb: (action: string) => void) => () => void
}
