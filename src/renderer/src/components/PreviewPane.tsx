import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Markdown, { type Components } from 'react-markdown'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import {
  MARKDOWN_REHYPE_PLUGINS,
  MARKDOWN_REMARK_PLUGINS,
  markdownPreviewUrlTransform
} from '@/lib/markdown-preview-plugins'
import { extractFrontMatter, markdownFrontMatterInner } from '@/lib/markdown-frontmatter'
import { buildMarkdownTableOfContents } from '@/lib/markdown-table-of-contents'
import { readGitHubCalloutKind } from '@shared/github-callouts'
import { useLocalImageSrc } from '@/lib/local-image-cache'
import { MermaidBlock, type RenderedMermaidDiagram } from '@/lib/mermaid/MermaidBlock'
import { CodeBlockCopyButton } from './CodeBlockCopyButton'
import { MarkdownGitHubCallout } from './MarkdownGitHubCallout'
import { MarkdownTableOfContentsPanel } from './MarkdownTableOfContentsPanel'

function hasMermaidCodeClass(value: unknown): boolean {
  return typeof value === 'string' && /language-mermaid/.test(value)
}

function PreviewImage({
  src,
  alt,
  baseFilePath,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { baseFilePath?: string }): React.JSX.Element {
  const resolved = useLocalImageSrc(src, baseFilePath)
  return <img {...props} src={resolved ?? src} alt={alt ?? ''} />
}

export function PreviewPane({
  content,
  filePath,
  isDark,
  fontZoomLevel,
  showToc,
  onCloseToc,
  searchOpenToken,
  onOpenRelativeMarkdown,
  onExpandMermaid
}: {
  content: string
  filePath?: string
  isDark: boolean
  fontZoomLevel: number
  showToc: boolean
  onCloseToc: () => void
  searchOpenToken: number
  onOpenRelativeMarkdown: (resolvedPath: string) => void
  onExpandMermaid: (diagram: RenderedMermaidDiagram) => void
}): React.JSX.Element {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [matchRanges, setMatchRanges] = useState<Range[]>([])
  const [activeMatchIndex, setActiveMatchIndex] = useState(0)

  const frontMatter = useMemo(() => extractFrontMatter(content), [content])
  const frontMatterText = useMemo(() => markdownFrontMatterInner(frontMatter), [frontMatter])
  const bodyContent = frontMatter ? frontMatter.body : content
  const tocItems = useMemo(() => buildMarkdownTableOfContents(bodyContent), [bodyContent])

  useEffect(() => {
    if (searchOpenToken > 0) {
      setIsSearchOpen(true)
      requestAnimationFrame(() => {
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      })
    }
  }, [searchOpenToken])

  // CSS Custom Highlight API search (same zero-DOM-mutation approach as Orca!)
  useEffect(() => {
    const cssHighlights = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights
    const clearHighlights = (): void => {
      cssHighlights?.delete('markdown-preview-search-match')
      cssHighlights?.delete('markdown-preview-search-active-match')
    }

    if (!isSearchOpen || !searchQuery.trim() || !bodyRef.current) {
      clearHighlights()
      setMatchRanges([])
      setActiveMatchIndex(0)
      return
    }

    const q = searchQuery.toLowerCase()
    const ranges: Range[] = []
    const walker = document.createTreeWalker(bodyRef.current, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      const text = node.textContent ?? ''
      const lower = text.toLowerCase()
      let idx = 0
      while ((idx = lower.indexOf(q, idx)) !== -1) {
        const range = document.createRange()
        range.setStart(node, idx)
        range.setEnd(node, idx + q.length)
        ranges.push(range)
        idx += q.length
      }
    }

    setMatchRanges(ranges)
    setActiveMatchIndex(0)

    const HighlightCtor = (window as unknown as { Highlight?: new (...r: Range[]) => unknown })
      .Highlight
    if (cssHighlights && HighlightCtor) {
      if (ranges.length > 0) {
        cssHighlights.set('markdown-preview-search-match', new HighlightCtor(...ranges))
        cssHighlights.set('markdown-preview-search-active-match', new HighlightCtor(ranges[0]))
      } else {
        clearHighlights()
      }
    }

    return clearHighlights
  }, [isSearchOpen, searchQuery, bodyContent])

  useEffect(() => {
    const cssHighlights = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights
    const HighlightCtor = (window as unknown as { Highlight?: new (...r: Range[]) => unknown })
      .Highlight
    const active = matchRanges[activeMatchIndex]
    if (cssHighlights && HighlightCtor && active) {
      cssHighlights.set('markdown-preview-search-active-match', new HighlightCtor(active))
      const el =
        active.startContainer instanceof Element
          ? active.startContainer
          : active.startContainer.parentElement
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [activeMatchIndex, matchRanges])

  const scrollToAnchor = useCallback((id: string) => {
    const container = scrollerRef.current
    if (!container) return
    const target = container.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const components = useMemo<Components>(() => {
    return {
      pre({ node, children, ...props }) {
        const isMermaid = node?.children.some(
          (child) =>
            child.type === 'element' &&
            child.tagName === 'code' &&
            Array.isArray(child.properties?.className) &&
            child.properties.className.some(hasMermaidCodeClass)
        )
        return (
          <CodeBlockCopyButton {...props} wrapInPre={!isMermaid}>
            {children}
          </CodeBlockCopyButton>
        )
      },
      blockquote({ node, children, ...props }) {
        const calloutKind = readGitHubCalloutKind(node?.properties?.dataCallout)
        if (calloutKind) {
          return <MarkdownGitHubCallout kind={calloutKind}>{children}</MarkdownGitHubCallout>
        }
        return <blockquote {...props}>{children}</blockquote>
      },
      a({ href, children, ...props }) {
        return (
          <a
            {...props}
            href={href}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              if (!href) return
              e.preventDefault()
              if (href.startsWith('#')) {
                scrollToAnchor(decodeURIComponent(href.slice(1)))
                return
              }
              if (/^(https?:|mailto:)/i.test(href)) {
                void window.api.openExternal(href)
                return
              }
              if (filePath && /\.(md|markdown|mdx)(#.*)?$/i.test(href)) {
                void window.api.resolveRelativePath(href, filePath).then((resolved) => {
                  if (resolved) onOpenRelativeMarkdown(resolved)
                })
                return
              }
              // Block non-http(s)/mailto links (including file:// executables or UNC shares).
            }}
          >
            {children}
          </a>
        )
      },
      img({ src, alt, ...props }) {
        return <PreviewImage {...props} src={src} alt={alt} baseFilePath={filePath} />
      },
      code({ className, children, ...props }) {
        if (hasMermaidCodeClass(className)) {
          return (
            <MermaidBlock
              content={String(children).trimEnd()}
              isDark={isDark}
              onExpand={onExpandMermaid}
            />
          )
        }
        return (
          <code className={className} {...props}>
            {children}
          </code>
        )
      }
    }
  }, [filePath, isDark, onExpandMermaid, onOpenRelativeMarkdown, scrollToAnchor])

  const moveMatch = (dir: 1 | -1): void => {
    if (matchRanges.length === 0) return
    setActiveMatchIndex((i) => (i + dir + matchRanges.length) % matchRanges.length)
  }

  return (
    <div
      className="markdown-preview-shell flex-1 min-h-0"
      style={{
        fontSize: `${14 + fontZoomLevel}px`,
        '--editor-font-zoom-level': fontZoomLevel
      } as React.CSSProperties}
    >
      {showToc ? (
        <MarkdownTableOfContentsPanel
          items={tocItems}
          onClose={onCloseToc}
          onNavigate={scrollToAnchor}
        />
      ) : null}

      <div
        ref={scrollerRef}
        className="markdown-preview overflow-y-auto scrollbar-editor"
        style={{ background: 'var(--editor-surface)' }}
      >
        {isSearchOpen ? (
          <div className="markdown-preview-search">
            <div className="markdown-preview-search-field">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsSearchOpen(false)
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    moveMatch(e.shiftKey ? -1 : 1)
                  }
                }}
                placeholder="Find in preview…"
                className="markdown-preview-search-input h-6 w-full bg-transparent px-1.5 text-foreground outline-none"
              />
            </div>
            <span className="markdown-preview-search-status">
              {matchRanges.length > 0 ? `${activeMatchIndex + 1} / ${matchRanges.length}` : '0 / 0'}
            </span>
            <div className="markdown-preview-search-divider" />
            <button
              type="button"
              className="markdown-preview-search-button flex items-center justify-center cursor-pointer"
              onClick={() => moveMatch(-1)}
              title="Previous match"
            >
              <ChevronUp className="size-3.5" />
            </button>
            <button
              type="button"
              className="markdown-preview-search-button flex items-center justify-center cursor-pointer"
              onClick={() => moveMatch(1)}
              title="Next match"
            >
              <ChevronDown className="size-3.5" />
            </button>
            <button
              type="button"
              className="markdown-preview-search-button flex items-center justify-center cursor-pointer"
              onClick={() => setIsSearchOpen(false)}
              title="Close (Esc)"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}

        <div ref={bodyRef} className="markdown-body">
          {frontMatterText ? (
            <details className="orca-frontmatter-card">
              <summary className="orca-frontmatter-summary">Frontmatter</summary>
              <pre className="orca-frontmatter-pre">{frontMatterText}</pre>
            </details>
          ) : null}
          <Markdown
            components={components}
            urlTransform={markdownPreviewUrlTransform}
            remarkPlugins={MARKDOWN_REMARK_PLUGINS}
            rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
          >
            {bodyContent}
          </Markdown>
        </div>
      </div>
    </div>
  )
}
