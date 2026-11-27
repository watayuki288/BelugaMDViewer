import React, { useEffect, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import type mermaidNamespace from 'mermaid'
import { readableMermaidFlowchartSvg } from '@shared/mermaid-flowchart-contrast'
import { getMermaidConfig } from './mermaid-config'
import { sanitizeMermaidSvg } from './mermaid-sanitize'
import { readMermaidThemeColors } from './mermaid-theme-colors'

type MermaidApi = typeof mermaidNamespace

let mermaidModulePromise: Promise<MermaidApi> | null = null
function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then((mod) => mod.default)
  }
  return mermaidModulePromise
}

export type RenderedMermaidDiagram = { svg: string; background?: string }

let renderQueue: Promise<void> = Promise.resolve()
function enqueueRender(fn: () => Promise<void>): void {
  const tail = renderQueue.then(fn, fn).then(() => {
    if (renderQueue === tail) {
      renderQueue = Promise.resolve()
    }
  })
  renderQueue = tail
}

let renderSequence = 0
function nextMermaidRenderId(): string {
  renderSequence += 1
  return `orcaMermaid${renderSequence}`
}

export function MermaidBlock({
  content,
  isDark,
  onExpand
}: {
  content: string
  isDark: boolean
  onExpand?: (diagram: RenderedMermaidDiagram) => void
}): React.JSX.Element {
  const [rendered, setRendered] = useState<RenderedMermaidDiagram | { error: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    const renderId = nextMermaidRenderId()

    const render = async (): Promise<void> => {
      try {
        const mermaid = await loadMermaid()
        if (cancelled) return
        const colors = readMermaidThemeColors()
        mermaid.initialize(getMermaidConfig(isDark, isDark ? colors : undefined))
        const { svg } = await mermaid.render(renderId, content)
        if (!cancelled) {
          const sanitized = sanitizeMermaidSvg(svg)
          setRendered({
            svg: colors
              ? readableMermaidFlowchartSvg(sanitized, colors.foreground, colors.background)
              : sanitized,
            background: colors?.background
          })
        }
      } catch (err) {
        if (!cancelled) {
          setRendered({
            error: err instanceof Error ? err.message : 'Invalid mermaid syntax'
          })
        }
        document.getElementById(`d${renderId}`)?.remove()
      }
    }

    enqueueRender(render)
    return () => {
      cancelled = true
    }
  }, [content, isDark])

  if (rendered && 'error' in rendered) {
    return (
      <div className="mermaid-block">
        <div className="mermaid-error">Diagram error: {rendered.error}</div>
        <pre>
          <code>{content}</code>
        </pre>
      </div>
    )
  }

  if (rendered && onExpand) {
    return (
      <div
        className="group/diagram relative cursor-zoom-in"
        onClick={() => {
          if (window.getSelection()?.isCollapsed === false) return
          onExpand(rendered)
        }}
      >
        <div className="mermaid-block" dangerouslySetInnerHTML={{ __html: rendered.svg }} />
        <button
          type="button"
          aria-label="Expand diagram"
          title="Expand diagram"
          onClick={(e) => {
            e.stopPropagation()
            onExpand(rendered)
          }}
          className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-accent-foreground group-hover/diagram:opacity-100"
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div
      className="mermaid-block"
      dangerouslySetInnerHTML={rendered ? { __html: rendered.svg } : undefined}
    />
  )
}
