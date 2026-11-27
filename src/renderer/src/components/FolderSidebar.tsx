import React, { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, RefreshCw, X } from 'lucide-react'
import type { FileTreeNode } from '@shared/types'

function TreeRow({
  node,
  depth,
  activeFilePath,
  onSelectFile
}: {
  node: FileTreeNode
  depth: number
  activeFilePath?: string
  onSelectFile: (filePath: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(depth < 1)
  const isActive = !node.isDirectory && activeFilePath === node.path

  if (node.isDirectory) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
        >
          {open ? (
            <ChevronDown className="size-3 shrink-0" />
          ) : (
            <ChevronRight className="size-3 shrink-0" />
          )}
          <Folder className="size-3.5 shrink-0 opacity-75" />
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children?.map((child) => (
          <TreeRow
            key={child.path}
            node={child}
            depth={depth + 1}
            activeFilePath={activeFilePath}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onSelectFile(node.path)}
      style={{ paddingLeft: `${20 + depth * 12}px` }}
      title={node.path}
      className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs cursor-pointer ${
        isActive
          ? 'bg-accent font-medium text-foreground'
          : 'text-foreground/85 hover:bg-accent/70 hover:text-foreground'
      }`}
    >
      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{node.name}</span>
    </button>
  )
}

export function FolderSidebar({
  rootPath,
  tree,
  activeFilePath,
  onOpenFolder,
  onRefresh,
  onSelectFile,
  onClose
}: {
  rootPath: string | null
  tree: FileTreeNode[]
  activeFilePath?: string
  onOpenFolder: () => void
  onRefresh: () => void
  onSelectFile: (filePath: string) => void
  onClose: () => void
}): React.JSX.Element {
  const folderName = rootPath ? rootPath.split(/[\\/]/).filter(Boolean).pop() ?? rootPath : null

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-10 items-center gap-1.5 border-b border-border px-3 text-xs font-semibold text-muted-foreground">
        <FolderOpen className="size-3.5 shrink-0" />
        <span className="truncate flex-1" title={rootPath ?? undefined}>
          {folderName ?? 'Explorer'}
        </span>
        {rootPath ? (
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh folder"
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent hover:text-foreground cursor-pointer"
          >
            <RefreshCw className="size-3" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          title="Close explorer"
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 scrollbar-editor">
        {!rootPath ? (
          <div className="flex flex-col items-center justify-center gap-2.5 px-3 py-8 text-center">
            <p className="text-xs text-muted-foreground">
              Open a folder to browse Markdown files.
            </p>
            <button
              type="button"
              onClick={onOpenFolder}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent cursor-pointer"
            >
              Open Folder…
            </button>
          </div>
        ) : tree.length === 0 ? (
          <div className="px-2 py-4 text-xs text-muted-foreground">
            No Markdown files found in this folder.
          </div>
        ) : (
          tree.map((node) => (
            <TreeRow
              key={node.path}
              node={node}
              depth={0}
              activeFilePath={activeFilePath}
              onSelectFile={onSelectFile}
            />
          ))
        )}
      </div>
    </aside>
  )
}
