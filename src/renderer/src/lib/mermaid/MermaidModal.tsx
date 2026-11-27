import React, { useEffect, useState } from 'react'
import { Minus, Plus, RotateCcw, X } from 'lucide-react'
import type { RenderedMermaidDiagram } from './MermaidBlock'

export function MermaidModal({
  diagram,
  onClose
}: {
  diagram: RenderedMermaidDiagram | null
  onClose: () => void
}): React.JSX.Element | null {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState<{ x: number; y: number; ox: number; oy: number } | null>(
    null
  )

  useEffect(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [diagram])

  useEffect(() => {
    if (!diagram) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [diagram, onClose])

  if (!diagram) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between border-b border-border bg-background/95 px-4 py-2"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs font-semibold text-muted-foreground">Mermaid Diagram Viewer</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            title="Zoom out"
            onClick={() => setScale((s) => Math.max(0.25, +(s - 0.2).toFixed(2)))}
          >
            <Minus className="size-3.5" />
          </button>
          <span className="min-w-[44px] text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            title="Zoom in"
            onClick={() => setScale((s) => Math.min(4, +(s + 0.2).toFixed(2)))}
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            title="Reset zoom"
            onClick={() => {
              setScale(1)
              setOffset({ x: 0, y: 0 })
            }}
          >
            <RotateCcw className="size-3.5" />
          </button>
          <button
            type="button"
            className="ml-2 flex h-7 w-7 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            title="Close (Esc)"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden select-none"
        style={{
          background: diagram.background ?? 'var(--editor-surface)',
          cursor: dragging ? 'grabbing' : 'grab'
        }}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => {
          e.preventDefault()
          const delta = e.deltaY < 0 ? 0.12 : -0.12
          setScale((s) => Math.min(4, Math.max(0.25, +(s + delta).toFixed(2))))
        }}
        onPointerDown={(e) => {
          setDragging({ x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y })
        }}
        onPointerMove={(e) => {
          if (!dragging) return
          setOffset({
            x: dragging.ox + (e.clientX - dragging.x),
            y: dragging.oy + (e.clientY - dragging.y)
          })
        }}
        onPointerUp={() => setDragging(null)}
        onPointerLeave={() => setDragging(null)}
      >
        <div
          className="mermaid-block p-8"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: 'center center'
          }}
          dangerouslySetInnerHTML={{ __html: diagram.svg }}
        />
      </div>
    </div>
  )
}
