import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Eye,
  FilePlus2,
  FolderOpen,
  ListTree,
  Monitor,
  Moon,
  PanelLeft,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sun,
  X
} from 'lucide-react'
import type { FileTreeNode, OpenFileResult, ThemePreference, ViewMode } from '@shared/types'
import { PreviewPane } from './components/PreviewPane'
import { RichMarkdownPane } from './components/rich-markdown/RichMarkdownPane'
import { FolderSidebar } from './components/FolderSidebar'
import { MermaidModal } from './lib/mermaid/MermaidModal'
import type { RenderedMermaidDiagram } from './lib/mermaid/MermaidBlock'

interface DocumentTab {
  id: string
  name: string
  filePath?: string
  content: string
  savedContent: string
  externalRevision: number
  pendingExternalContent?: string
}

const WELCOME_MARKDOWN = `# Welcome to BelugaMDViewer

**BelugaMDViewer** is a standalone Windows Markdown viewer & rich WYSIWYG editor built for a clean, Word-like writing experience.

> [!TIP]
> Switch anytime between **Edit** (Tiptap WYSIWYG) and **Preview** (GitHub-flavored rendered view) using the top-right toggle or \`Ctrl+Shift+V\`. Your Undo/Redo history (\`Ctrl+Z\` / \`Ctrl+Y\`) is preserved even when switching views or tabs! Type \`/\` in Edit mode to insert blocks.

## Features Included

- [x] **Rich WYSIWYG Editing** with Undo / Redo (\`Ctrl+Z\` / \`Ctrl+Y\` / \`Ctrl+Shift+Z\`)
- [x] **GitHub Flavored Markdown** tables, task lists, strikethrough & autolinks
- [x] **Syntax Highlighted Code Blocks** with copy button & language switcher
- [x] **Mermaid Diagrams** with click-to-expand pan & zoom viewer
- [x] **KaTeX Math** inline ($E = mc^2$) and display equations
- [x] **Table of Contents** collapsible outline & in-document search (\`Ctrl+F\`)
- [x] **Drag & Drop** \`.md\` files or open a folder sidebar (\`Ctrl+B\`)

## Math Example

$$
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

## Mermaid Diagram

\`\`\`mermaid
flowchart LR
  A[Markdown File .md] --> B{BelugaMDViewer}
  B -->|Ctrl+Shift+V| C[Rich WYSIWYG Editor]
  B -->|Ctrl+Shift+V| D[Rendered Preview]
  C --> E[Clean GFM Save]
\`\`\`

## Code Example

\`\`\`typescript
export function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

## Table Example

| Shortcut | Action |
| --- | --- |
| \`Ctrl+Z\` / \`Ctrl+Y\` | Undo / Redo |
| \`Ctrl+O\` | Open Markdown file |
| \`Ctrl+S\` | Save current file |
| \`Ctrl+Shift+V\` | Toggle Rich Edit / Preview |
| \`Ctrl+Shift+T\` | Toggle Table of Contents |
| \`Ctrl+F\` | Find in document |
`

let nextTabCounter = 1
function createTabId(): string {
  nextTabCounter += 1
  return `tab-${nextTabCounter}`
}

function getSystemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function App(): React.JSX.Element {
  const [tabs, setTabs] = useState<DocumentTab[]>(() => [
    {
      id: 'welcome-tab',
      name: 'Welcome.md',
      content: WELCOME_MARKDOWN,
      savedContent: WELCOME_MARKDOWN,
      externalRevision: 0
    }
  ])
  const [activeTabId, setActiveTabId] = useState<string>('welcome-tab')
  const [viewMode, setViewMode] = useState<ViewMode>('rich')
  const [showToc, setShowToc] = useState<boolean>(true)
  const [showSidebar, setShowSidebar] = useState<boolean>(false)
  const [folderRoot, setFolderRoot] = useState<string | null>(null)
  const [folderTree, setFolderTree] = useState<FileTreeNode[]>([])
  const [themePref, setThemePref] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem('belugamdviewer-theme')
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'dark'
  })
  const [systemDark, setSystemDark] = useState<boolean>(() => getSystemDark())
  const [fontZoomLevel, setFontZoomLevel] = useState<number>(0)
  const [searchOpenToken, setSearchOpenToken] = useState<number>(0)
  const [historyAction, setHistoryAction] = useState<{
    type: 'undo' | 'redo'
    token: number
  } | null>(null)
  const [expandedMermaid, setExpandedMermaid] = useState<RenderedMermaidDiagram | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const toastTimerRef = useRef<number | null>(null)
  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = window.setTimeout(() => {
      toastTimerRef.current = null
      setToast(null)
    }, 2200)
  }, [])

  const isDark = themePref === 'dark' || (themePref === 'system' && systemDark)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    localStorage.setItem('belugamdviewer-theme', themePref)
    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.classList.toggle('light', !isDark)
  }, [themePref, isDark])

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0] ?? null,
    [tabs, activeTabId]
  )

  useEffect(() => {
    if (!activeTab) {
      document.title = 'BelugaMDViewer'
      return
    }
    const dirty = activeTab.content !== activeTab.savedContent ? '● ' : ''
    document.title = `${dirty}${activeTab.name} — BelugaMDViewer`
  }, [activeTab])

  const openLoadedFiles = useCallback((files: OpenFileResult[]) => {
    if (files.length === 0) return
    let targetId = ''
    setTabs((prev) => {
      const next = [...prev]
      // Replace untouched welcome tab when opening first real file
      const isOnlyUntouchedWelcome =
        next.length === 1 &&
        next[0].id === 'welcome-tab' &&
        !next[0].filePath &&
        next[0].content === next[0].savedContent

      if (isOnlyUntouchedWelcome) {
        next.length = 0
      }

      for (const f of files) {
        const existing = next.find((t) => t.filePath === f.filePath)
        if (existing) {
          targetId = existing.id
        } else {
          const id = createTabId()
          next.push({
            id,
            name: f.name,
            filePath: f.filePath,
            content: f.content,
            savedContent: f.content,
            externalRevision: 0
          })
          targetId = id
          void window.api.watchFile(f.filePath)
        }
      }
      return next
    })
    if (targetId) setActiveTabId(targetId)
  }, [])

  // Load files passed via CLI args on launch & listen for second-instance opens
  useEffect(() => {
    void window.api.getInitialFiles().then((files) => {
      if (files.length > 0) openLoadedFiles(files)
    })
    const offOpen = window.api.onOpenFilesFromOs((files) => openLoadedFiles(files))
    const offChanged = window.api.onExternalFileChanged(({ filePath, content }) => {
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.filePath !== filePath) return tab
          if (tab.content === content) return tab
          const isDirty = tab.content !== tab.savedContent
          if (!isDirty) {
            return {
              ...tab,
              content,
              savedContent: content,
              externalRevision: tab.externalRevision + 1,
              pendingExternalContent: undefined
            }
          }
          return { ...tab, pendingExternalContent: content }
        })
      )
    })
    return () => {
      offOpen()
      offChanged()
    }
  }, [openLoadedFiles])

  const handleNewTab = useCallback(() => {
    const id = createTabId()
    setTabs((prev) => [
      ...prev,
      {
        id,
        name: 'Untitled.md',
        content: '',
        savedContent: '',
        externalRevision: 0
      }
    ])
    setActiveTabId(id)
    setViewMode('rich')
  }, [])

  const handleOpenFiles = useCallback(async () => {
    const files = await window.api.openFileDialog()
    openLoadedFiles(files)
  }, [openLoadedFiles])

  const handleOpenFolder = useCallback(async () => {
    const res = await window.api.openFolderDialog()
    if (!res) return
    setFolderRoot(res.rootPath)
    setFolderTree(res.tree)
    setShowSidebar(true)
  }, [])

  const handleRefreshFolder = useCallback(async () => {
    if (!folderRoot) return
    const tree = await window.api.readFolderTree(folderRoot)
    setFolderTree(tree)
  }, [folderRoot])

  const handleOpenPath = useCallback(
    async (filePath: string) => {
      const file = await window.api.readFile(filePath)
      if (file) {
        openLoadedFiles([file])
      }
    },
    [openLoadedFiles]
  )

  const handleSave = useCallback(
    async (forceSaveAs = false) => {
      if (!activeTab) return
      if (!forceSaveAs && activeTab.filePath) {
        const res = await window.api.saveFile(activeTab.filePath, activeTab.content)
        if (res.ok) {
          setTabs((prev) =>
            prev.map((t) =>
              t.id === activeTab.id
                ? { ...t, savedContent: t.content, pendingExternalContent: undefined }
                : t
            )
          )
          showToast(`Saved ${activeTab.name}`)
        } else {
          showToast(`Save failed: ${res.error ?? 'Unknown error'}`)
        }
        return
      }

      const saved = await window.api.saveFileAsDialog(activeTab.name, activeTab.content)
      if (!saved) return
      void window.api.watchFile(saved.filePath)
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTab.id
            ? {
                ...t,
                filePath: saved.filePath,
                name: saved.name,
                savedContent: t.content,
                pendingExternalContent: undefined
              }
            : t
        )
      )
      showToast(`Saved ${saved.name}`)
    },
    [activeTab, showToast]
  )

  const handleCloseTab = useCallback(
    (tabId: string) => {
      const target = tabs.find((t) => t.id === tabId)
      if (!target) return
      if (target.content !== target.savedContent) {
        const ok = window.confirm(`"${target.name}" has unsaved changes. Close anyway?`)
        if (!ok) return
      }
      if (target.filePath) {
        void window.api.unwatchFile(target.filePath)
      }
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === tabId)
        const next = prev.filter((t) => t.id !== tabId)
        if (next.length === 0) {
          const freshId = createTabId()
          setActiveTabId(freshId)
          return [
            {
              id: freshId,
              name: 'Untitled.md',
              content: '',
              savedContent: '',
              externalRevision: 0
            }
          ]
        }
        if (activeTabId === tabId) {
          const fallback = next[Math.min(idx, next.length - 1)]
          setActiveTabId(fallback.id)
        }
        return next
      })
    },
    [tabs, activeTabId]
  )

  const handleTabContentChange = useCallback((tabId: string, nextMarkdown: string) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, content: nextMarkdown } : t)))
  }, [])

  // Menu & keyboard shortcut wiring
  const actionsRef = useRef({
    handleNewTab,
    handleOpenFiles,
    handleOpenFolder,
    handleSave,
    handleCloseTab,
    activeTabId
  })
  actionsRef.current = {
    handleNewTab,
    handleOpenFiles,
    handleOpenFolder,
    handleSave,
    handleCloseTab,
    activeTabId
  }

  useEffect(() => {
    const offMenu = window.api.onMenuAction((action) => {
      const a = actionsRef.current
      switch (action) {
        case 'new':
          a.handleNewTab()
          break
        case 'open':
          void a.handleOpenFiles()
          break
        case 'open-folder':
          void a.handleOpenFolder()
          break
        case 'save':
          void a.handleSave(false)
          break
        case 'save-as':
          void a.handleSave(true)
          break
        case 'close-tab':
          a.handleCloseTab(a.activeTabId)
          break
        case 'undo':
          setHistoryAction((prev) => ({ type: 'undo', token: (prev?.token ?? 0) + 1 }))
          break
        case 'redo':
          setHistoryAction((prev) => ({ type: 'redo', token: (prev?.token ?? 0) + 1 }))
          break
        case 'find':
          setSearchOpenToken((n) => n + 1)
          break
        case 'toggle-mode':
          setViewMode((m) => (m === 'rich' ? 'preview' : 'rich'))
          break
        case 'toggle-toc':
          setShowToc((v) => !v)
          break
        case 'toggle-sidebar':
          setShowSidebar((v) => !v)
          break
        case 'zoom-in':
          setFontZoomLevel((z) => Math.min(8, z + 1))
          break
        case 'zoom-out':
          setFontZoomLevel((z) => Math.max(-4, z - 1))
          break
        case 'zoom-reset':
          setFontZoomLevel(0)
          break
      }
    })
    return offMenu
  }, [])

  const cycleTheme = (): void => {
    setThemePref((t) => (t === 'dark' ? 'light' : t === 'light' ? 'system' : 'dark'))
  }

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      if (/\.(md|markdown|mdx|mdown|mkd|txt)$/i.test(file.name)) {
        void window.api.openDroppedFile(file).then((loaded) => {
          if (loaded) openLoadedFiles([loaded])
        })
      }
    }
  }

  return (
    <div
      className="flex h-full w-full flex-col bg-editor-surface text-foreground select-none"
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragOver(false)
      }}
      onDrop={handleDrop}
    >
      {/* Top App & Tab Bar */}
      <header className="flex h-10 shrink-0 items-center gap-1 border-b border-border bg-background px-2">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setShowSidebar((v) => !v)}
            title="Toggle Folder Explorer (Ctrl+B)"
            className={`flex h-7 w-7 items-center justify-center rounded-md cursor-pointer ${
              showSidebar
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <PanelLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => void handleOpenFiles()}
            title="Open Markdown File (Ctrl+O)"
            className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
          >
            <FolderOpen className="size-3.5" />
            <span className="hidden sm:inline">Open</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSave(false)}
            title="Save (Ctrl+S)"
            className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
          >
            <Save className="size-3.5" />
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>

        <div className="mx-1 h-4 w-px bg-border" />

        {/* Document Tabs */}
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab?.id
            const isDirty = tab.content !== tab.savedContent
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                title={tab.filePath ?? tab.name}
                className={`group flex h-7 max-w-48 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <span className="truncate">{tab.name}</span>
                {isDirty ? (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-callout-note"
                    title="Unsaved changes"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCloseTab(tab.id)
                  }}
                  aria-label={`Close ${tab.name}`}
                  className="ml-0.5 flex size-4 items-center justify-center rounded opacity-60 hover:bg-background/60 hover:opacity-100 cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </div>
            )
          })}
          <button
            type="button"
            onClick={handleNewTab}
            title="New Document (Ctrl+N)"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        <div className="mx-1 h-4 w-px bg-border" />

        {/* Right Controls: Mode Switcher + ToC + Find + Theme */}
        <div className="flex shrink-0 items-center gap-1">
          <div
            className="flex items-center rounded-md border border-border bg-muted/60 p-0.5"
            role="tablist"
            aria-label="Editor view mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'rich'}
              onClick={() => setViewMode('rich')}
              title="Rich Edit (Ctrl+Shift+V)"
              className={`flex h-6 items-center gap-1 rounded px-2 text-xs font-medium cursor-pointer transition-colors ${
                viewMode === 'rich'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Pencil className="size-3" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'preview'}
              onClick={() => setViewMode('preview')}
              title="Rendered Preview (Ctrl+Shift+V)"
              className={`flex h-6 items-center gap-1 rounded px-2 text-xs font-medium cursor-pointer transition-colors ${
                viewMode === 'preview'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="size-3" />
              <span>Preview</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowToc((v) => !v)}
            title="Toggle Table of Contents (Ctrl+Shift+T)"
            className={`flex h-7 w-7 items-center justify-center rounded-md cursor-pointer ${
              showToc
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <ListTree className="size-4" />
          </button>

          <button
            type="button"
            onClick={() => setSearchOpenToken((n) => n + 1)}
            title="Find in Document (Ctrl+F)"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
          >
            <Search className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={cycleTheme}
            title={`Theme: ${themePref} (click to switch)`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
          >
            {themePref === 'dark' ? (
              <Moon className="size-3.5" />
            ) : themePref === 'light' ? (
              <Sun className="size-3.5" />
            ) : (
              <Monitor className="size-3.5" />
            )}
          </button>
        </div>
      </header>

      {/* External File Change Conflict Banner */}
      {activeTab?.pendingExternalContent !== undefined ? (
        <div className="flex items-center justify-between border-b border-border bg-status-warning/15 px-4 py-1.5 text-xs">
          <span>
            <strong>{activeTab.name}</strong> was modified on disk while you have unsaved edits.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTabs((prev) =>
                  prev.map((t) =>
                    t.id === activeTab.id && t.pendingExternalContent !== undefined
                      ? {
                          ...t,
                          content: t.pendingExternalContent,
                          savedContent: t.pendingExternalContent,
                          externalRevision: t.externalRevision + 1,
                          pendingExternalContent: undefined
                        }
                      : t
                  )
                )
              }}
              className="flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-primary-foreground cursor-pointer"
            >
              <RefreshCw className="size-3" /> Reload from disk
            </button>
            <button
              type="button"
              onClick={() =>
                setTabs((prev) =>
                  prev.map((t) =>
                    t.id === activeTab.id ? { ...t, pendingExternalContent: undefined } : t
                  )
                )
              }
              className="rounded px-2 py-0.5 text-muted-foreground hover:bg-accent cursor-pointer"
            >
              Keep mine
            </button>
          </div>
        </div>
      ) : null}

      {/* Main Content Area */}
      <div className="relative flex min-h-0 flex-1 select-text">
        {showSidebar ? (
          <FolderSidebar
            rootPath={folderRoot}
            tree={folderTree}
            activeFilePath={activeTab?.filePath}
            onOpenFolder={() => void handleOpenFolder()}
            onRefresh={() => void handleRefreshFolder()}
            onSelectFile={(p) => void handleOpenPath(p)}
            onClose={() => setShowSidebar(false)}
          />
        ) : null}

        {activeTab ? (
          <>
            {viewMode === 'preview' ? (
              <PreviewPane
                key={`preview-${activeTab.id}`}
                content={activeTab.content}
                filePath={activeTab.filePath}
                isDark={isDark}
                fontZoomLevel={fontZoomLevel}
                showToc={showToc}
                onCloseToc={() => setShowToc(false)}
                searchOpenToken={searchOpenToken}
                onOpenRelativeMarkdown={(p) => void handleOpenPath(p)}
                onExpandMermaid={setExpandedMermaid}
              />
            ) : null}
            {/* Keep each open tab's RichMarkdownPane mounted so Undo/Redo history & scroll survive Preview switches and tab switches. */}
            {tabs.map((tab) => (
              <RichMarkdownPane
                key={`rich-${tab.id}`}
                tabId={tab.id}
                hidden={tab.id !== activeTab.id || viewMode !== 'rich'}
                content={tab.content}
                externalRevision={tab.externalRevision}
                filePath={tab.filePath}
                fontZoomLevel={fontZoomLevel}
                showToc={showToc}
                onCloseToc={() => setShowToc(false)}
                searchOpenToken={searchOpenToken}
                historyAction={historyAction}
                onChange={(nextMarkdown) => handleTabContentChange(tab.id, nextMarkdown)}
                onExpandMermaid={setExpandedMermaid}
                onOpenRelativeMarkdown={(p) => void handleOpenPath(p)}
              />
            ))}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <FilePlus2 className="size-8 opacity-50" />
            <p>No document open</p>
          </div>
        )}

        {isDragOver ? (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-xs">
            <div className="rounded-xl border-2 border-dashed border-callout-note bg-card px-8 py-6 text-sm font-medium text-foreground shadow-lg">
              Drop Markdown (.md) file to open
            </div>
          </div>
        ) : null}
      </div>

      {/* Subtle Bottom Status Bar */}
      <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-background px-3 text-[11px] text-muted-foreground">
        <span className="truncate">{activeTab?.filePath ?? 'Unsaved document'}</span>
        <div className="flex items-center gap-3 tabular-nums">
          {toast ? <span className="font-medium text-callout-note">{toast}</span> : null}
          <span>{viewMode === 'rich' ? 'Rich Edit (Tiptap)' : 'Preview'}</span>
          {fontZoomLevel !== 0 ? (
            <span>Zoom {fontZoomLevel > 0 ? `+${fontZoomLevel}` : fontZoomLevel}</span>
          ) : null}
        </div>
      </footer>

      <MermaidModal diagram={expandedMermaid} onClose={() => setExpandedMermaid(null)} />
    </div>
  )
}
