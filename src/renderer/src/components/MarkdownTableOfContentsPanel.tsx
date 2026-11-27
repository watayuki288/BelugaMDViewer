import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, ListTree, X } from 'lucide-react'
import type { MarkdownTocItem, MarkdownTocLevel } from '@/lib/markdown-table-of-contents'
import {
  collapseMarkdownTocToLevel,
  pruneMarkdownTocCollapsedIds,
  toggleMarkdownTocCollapsedId
} from '@/lib/markdown-toc-collapse-state'

const TOC_LEVELS: MarkdownTocLevel[] = [1, 2, 3, 4, 5]
const TOC_EXPAND_ALL_LEVEL: MarkdownTocLevel = 5

function TocRow({
  item,
  depth,
  collapsedIds,
  onNavigate,
  onToggleCollapsed
}: {
  item: MarkdownTocItem
  depth: number
  collapsedIds: ReadonlySet<string>
  onNavigate: (id: string) => void
  onToggleCollapsed: (id: string) => void
}): React.JSX.Element {
  const hasChildren = item.children.length > 0
  const isCollapsed = collapsedIds.has(item.id)

  return (
    <div>
      <div className="markdown-toc-row" style={{ paddingLeft: `${8 + depth * 12}px` }}>
        {hasChildren ? (
          <button
            type="button"
            className="markdown-toc-disclosure text-muted-foreground"
            onClick={() => onToggleCollapsed(item.id)}
            aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
          >
            {isCollapsed ? (
              <ChevronRight className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
          </button>
        ) : (
          <span className="markdown-toc-disclosure" />
        )}
        <button
          type="button"
          className="markdown-toc-title-button cursor-pointer"
          title={item.title}
          onClick={() => onNavigate(item.id)}
        >
          <span className="markdown-toc-title">{item.title}</span>
        </button>
      </div>
      {hasChildren && !isCollapsed
        ? item.children.map((child) => (
            <TocRow
              key={child.id}
              item={child}
              depth={depth + 1}
              collapsedIds={collapsedIds}
              onNavigate={onNavigate}
              onToggleCollapsed={onToggleCollapsed}
            />
          ))
        : null}
    </div>
  )
}

export function MarkdownTableOfContentsPanel({
  items,
  onClose,
  onNavigate
}: {
  items: MarkdownTocItem[]
  onClose: () => void
  onNavigate: (id: string) => void
}): React.JSX.Element {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set())
  const [width, setWidth] = useState(240)
  const draggingRef = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    setCollapsedIds((current) => pruneMarkdownTocCollapsedIds(current, items))
  }, [items])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent): void => {
      if (!draggingRef.current) return
      const next = Math.min(420, Math.max(180, draggingRef.current.startWidth + (e.clientX - draggingRef.current.startX)))
      setWidth(next)
    }
    const onMouseUp = (): void => {
      draggingRef.current = null
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <aside
      className="markdown-toc-panel"
      style={{ width: `${width}px` }}
      aria-label="Table of contents"
    >
      <div className="markdown-toc-header">
        <ListTree className="size-3.5 text-muted-foreground" />
        <span>Contents</span>
        <div className="markdown-toc-header-actions">
          <div className="markdown-toc-level-controls" role="group" aria-label="Collapse by level">
            {TOC_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                className="markdown-toc-level-button h-6 rounded hover:bg-accent cursor-pointer"
                title={level === TOC_EXPAND_ALL_LEVEL ? 'Expand all' : `Collapse to H${level}`}
                onClick={() => setCollapsedIds(collapseMarkdownTocToLevel(items, level))}
              >
                H{level}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
            title="Close table of contents"
            onClick={onClose}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="markdown-toc-list scrollbar-editor">
        {items.length > 0 ? (
          items.map((item) => (
            <TocRow
              key={item.id}
              item={item}
              depth={0}
              collapsedIds={collapsedIds}
              onNavigate={onNavigate}
              onToggleCollapsed={(id) =>
                setCollapsedIds((cur) => toggleMarkdownTocCollapsedId(cur, id))
              }
            />
          ))
        ) : (
          <div className="markdown-toc-empty">No headings</div>
        )}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={(e) => {
          e.preventDefault()
          draggingRef.current = { startX: e.clientX, startWidth: width }
        }}
        className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-ring/40"
      />
    </aside>
  )
}
