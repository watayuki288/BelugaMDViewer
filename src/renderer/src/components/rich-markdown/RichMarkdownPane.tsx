import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import {
  extractFrontMatter,
  markdownFrontMatterInner,
  prependFrontMatter
} from '@/lib/markdown-frontmatter'
import { buildMarkdownTableOfContents } from '@/lib/markdown-table-of-contents'
import type { RenderedMermaidDiagram } from '@/lib/mermaid/MermaidBlock'
import { MarkdownTableOfContentsPanel } from '../MarkdownTableOfContentsPanel'
import { createRichMarkdownExtensions } from './rich-markdown-extensions'
import { RichMarkdownToolbar } from './RichMarkdownToolbar'
import {
  filterSlashCommands,
  RichMarkdownSlashMenu,
  type SlashCommandItem,
  type SlashMenuState
} from './RichMarkdownSlashMenu'
import { RichMarkdownLinkBubble } from './RichMarkdownLinkBubble'
import { RichMarkdownTableControls } from './RichMarkdownTableControls'

interface LinkBubbleState {
  href: string
  left: number
  top: number
  initialEditing: boolean
}

export function RichMarkdownPane({
  tabId,
  hidden = false,
  content,
  externalRevision,
  filePath,
  fontZoomLevel,
  showToc,
  onCloseToc,
  searchOpenToken,
  historyAction,
  onChange,
  onExpandMermaid,
  onOpenRelativeMarkdown
}: {
  tabId: string
  hidden?: boolean
  content: string
  externalRevision: number
  filePath?: string
  fontZoomLevel: number
  showToc: boolean
  onCloseToc: () => void
  searchOpenToken: number
  historyAction?: { type: 'undo' | 'redo'; token: number } | null
  onChange: (nextMarkdown: string) => void
  onExpandMermaid: (diagram: RenderedMermaidDiagram) => void
  onOpenRelativeMarkdown: (resolvedPath: string) => void
}): React.JSX.Element {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const frontMatter = useMemo(() => extractFrontMatter(content), [content])
  const frontMatterRawRef = useRef<string | null>(frontMatter?.raw ?? null)
  frontMatterRawRef.current = frontMatter?.raw ?? null
  const frontMatterText = useMemo(() => markdownFrontMatterInner(frontMatter), [frontMatter])
  const bodyMarkdown = frontMatter ? frontMatter.body : content

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const isProgrammaticRef = useRef(false)
  const lastEmittedBodyRef = useRef<string>(bodyMarkdown)

  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0)
  const [linkBubble, setLinkBubble] = useState<LinkBubbleState | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [matchRanges, setMatchRanges] = useState<Range[]>([])
  const [activeMatchIndex, setActiveMatchIndex] = useState(0)
  const [, setToolbarTick] = useState(0)

  const filteredSlashCommands = useMemo(
    () => (slashMenu ? filterSlashCommands(slashMenu.query) : []),
    [slashMenu]
  )

  const slashMenuRef = useRef(slashMenu)
  slashMenuRef.current = slashMenu
  const filteredSlashRef = useRef(filteredSlashCommands)
  filteredSlashRef.current = filteredSlashCommands
  const selectedSlashIdxRef = useRef(selectedSlashIndex)
  selectedSlashIdxRef.current = selectedSlashIndex

  const extensions = useMemo(() => createRichMarkdownExtensions(), [])

  const editor = useEditor(
    {
      extensions,
      content: bodyMarkdown,
      contentType: 'markdown',
      editorProps: {
        attributes: {
          class: 'rich-markdown-editor'
        },
        handleKeyDown(view, event) {
          const menu = slashMenuRef.current
          if (menu) {
            const cmds = filteredSlashRef.current
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setSelectedSlashIndex((i) => (cmds.length ? (i + 1) % cmds.length : 0))
              return true
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setSelectedSlashIndex((i) => (cmds.length ? (i - 1 + cmds.length) % cmds.length : 0))
              return true
            }
            if (event.key === 'Enter' && cmds.length > 0) {
              event.preventDefault()
              const chosen = cmds[selectedSlashIdxRef.current] ?? cmds[0]
              if (chosen) {
                executeSlashRef.current(chosen)
              }
              return true
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setSlashMenu(null)
              return true
            }
          }

          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault()
            openLinkEditorRef.current()
            return true
          }

          if ((event.ctrlKey || event.metaKey) && !event.altKey) {
            const key = event.key.toLowerCase()
            if (key === 'z' && !event.shiftKey) {
              event.preventDefault()
              editorRef.current?.chain().focus().undo().run()
              return true
            }
            if (key === 'y' || (key === 'z' && event.shiftKey)) {
              event.preventDefault()
              editorRef.current?.chain().focus().redo().run()
              return true
            }
          }

          void view
          return false
        },
        handleClick(_view, _pos, event) {
          const target = event.target as HTMLElement | null
          const link = target?.closest('a')
          if (link) {
            const href = link.getAttribute('href') ?? ''
            if ((event.ctrlKey || event.metaKey) && href) {
              event.preventDefault()
              openLinkHrefRef.current(href)
              return true
            }
            const rect = link.getBoundingClientRect()
            setLinkBubble({
              href,
              left: rect.left,
              top: rect.bottom + 6,
              initialEditing: false
            })
            return true
          }
          setLinkBubble(null)
          return false
        }
      },
      onUpdate({ editor: ed }) {
        if (isProgrammaticRef.current) return
        const nextBody = ed.getMarkdown()
        lastEmittedBodyRef.current = nextBody
        const full = frontMatterRawRef.current
          ? prependFrontMatter(frontMatterRawRef.current, nextBody)
          : nextBody
        onChangeRef.current(full)

        // Detect `/` slash trigger
        const { selection } = ed.state
        if (selection.empty) {
          const { $from } = selection
          if ($from.parent.isTextblock && $from.parent.type.name !== 'codeBlock') {
            const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc')
            const match = textBefore.match(/(?:^|\s)\/([a-zA-Z0-9-]*)$/)
            if (match) {
              const query = match[1]
              const slashStartOffset = $from.parentOffset - query.length - 1
              const from = $from.start() + slashStartOffset
              const to = selection.from
              const coords = ed.view.coordsAtPos(selection.from)
              setSlashMenu({
                query,
                from,
                to,
                left: coords.left,
                top: coords.bottom + 6
              })
              setSelectedSlashIndex(0)
              return
            }
          }
        }
        setSlashMenu(null)
      },
      onSelectionUpdate() {
        setToolbarTick((n) => n + 1)
      },
      onTransaction() {
        setToolbarTick((n) => n + 1)
      }
    },
    [tabId]
  )

  const editorRef = useRef(editor)
  editorRef.current = editor

  // Handle Electron menu Undo / Redo actions while respecting focused text inputs
  useEffect(() => {
    if (!historyAction || hidden || !editor) return
    const active = document.activeElement
    if (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement
    ) {
      document.execCommand(historyAction.type)
      return
    }
    if (historyAction.type === 'undo') {
      editor.chain().focus().undo().run()
    } else {
      editor.chain().focus().redo().run()
    }
  }, [historyAction, hidden, editor])

  // Keep storage metadata updated for local images & mermaid expansion
  useEffect(() => {
    if (!editor) return
    const meta = (
      editor.storage as unknown as {
        orcaMeta?: { filePath: string; onExpandMermaid?: (d: RenderedMermaidDiagram) => void }
      }
    ).orcaMeta
    if (meta) {
      meta.filePath = filePath ?? ''
      meta.onExpandMermaid = onExpandMermaid
    }
  }, [editor, filePath, onExpandMermaid])

  // Sync external file reloads into Tiptap without fighting local typing
  useEffect(() => {
    if (!editor) return
    if (bodyMarkdown === lastEmittedBodyRef.current && externalRevision === 0) return
    isProgrammaticRef.current = true
    try {
      editor.commands.setContent(bodyMarkdown, { contentType: 'markdown' })
      lastEmittedBodyRef.current = bodyMarkdown
    } finally {
      isProgrammaticRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalRevision, editor])

  const handleImagePick = useCallback(() => {
    if (!editor) return
    void window.api.pickImageDialog(filePath).then((picked) => {
      if (!picked) return
      editor.chain().focus().setImage({ src: picked, alt: '' }).run()
    })
  }, [editor, filePath])

  const executeSlashCommand = useCallback(
    (cmd: SlashCommandItem) => {
      if (!editor || !slashMenuRef.current) return
      const { from, to } = slashMenuRef.current
      editor.chain().focus().deleteRange({ from, to }).run()
      setSlashMenu(null)
      cmd.run(editor, handleImagePick)
    },
    [editor, handleImagePick]
  )
  const executeSlashRef = useRef(executeSlashCommand)
  executeSlashRef.current = executeSlashCommand

  const openLinkEditor = useCallback(() => {
    if (!editor) return
    const attrs = editor.getAttributes('link')
    const href = typeof attrs.href === 'string' ? attrs.href : ''
    const coords = editor.view.coordsAtPos(editor.state.selection.from)
    setLinkBubble({
      href,
      left: coords.left,
      top: coords.bottom + 8,
      initialEditing: true
    })
  }, [editor])
  const openLinkEditorRef = useRef(openLinkEditor)
  openLinkEditorRef.current = openLinkEditor

  const openLinkHref = useCallback(
    (href: string) => {
      if (!href) return
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
    },
    [filePath, onOpenRelativeMarkdown]
  )
  const openLinkHrefRef = useRef(openLinkHref)
  openLinkHrefRef.current = openLinkHref

  const tocItems = useMemo(() => buildMarkdownTableOfContents(bodyMarkdown), [bodyMarkdown])

  const handleNavigateToc = useCallback(
    (id: string) => {
      const container = scrollContainerRef.current
      if (!container) return
      const headings = container.querySelectorAll<HTMLElement>(
        '.rich-markdown-editor h1, .rich-markdown-editor h2, .rich-markdown-editor h3, .rich-markdown-editor h4, .rich-markdown-editor h5'
      )
      // Match heading text to ToC slug
      const flat: Array<{ id: string; title: string }> = []
      const flatten = (items: typeof tocItems): void => {
        for (const item of items) {
          flat.push({ id: item.id, title: item.title })
          flatten(item.children)
        }
      }
      flatten(tocItems)
      const targetIndex = flat.findIndex((x) => x.id === id)
      const targetEl = targetIndex >= 0 ? headings[targetIndex] : null
      targetEl?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [tocItems]
  )

  useEffect(() => {
    if (!hidden && searchOpenToken > 0) {
      setIsSearchOpen(true)
      requestAnimationFrame(() => {
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      })
    }
  }, [searchOpenToken, hidden])

  // CSS Custom Highlight search in Rich Editor
  useEffect(() => {
    const cssHighlights = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights
    const clearHighlights = (): void => {
      cssHighlights?.delete('markdown-preview-search-match')
      cssHighlights?.delete('markdown-preview-search-active-match')
    }

    const editorEl = scrollContainerRef.current?.querySelector('.rich-markdown-editor')
    if (!isSearchOpen || !searchQuery.trim() || !editorEl) {
      clearHighlights()
      setMatchRanges([])
      setActiveMatchIndex(0)
      return
    }

    const q = searchQuery.toLowerCase()
    const ranges: Range[] = []
    const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT)
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
    if (cssHighlights && HighlightCtor && ranges.length > 0) {
      cssHighlights.set('markdown-preview-search-match', new HighlightCtor(...ranges))
      cssHighlights.set('markdown-preview-search-active-match', new HighlightCtor(ranges[0]))
    } else {
      clearHighlights()
    }
    return clearHighlights
  }, [isSearchOpen, searchQuery, bodyMarkdown])

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

  const moveMatch = (dir: 1 | -1): void => {
    if (matchRanges.length === 0) return
    setActiveMatchIndex((i) => (i + dir + matchRanges.length) % matchRanges.length)
  }

  return (
    <div
      className={`rich-markdown-editor-layout flex-1 min-h-0 ${hidden ? 'hidden' : ''}`}
      style={hidden ? { display: 'none' } : undefined}
    >
      {showToc ? (
        <MarkdownTableOfContentsPanel
          items={tocItems}
          onClose={onCloseToc}
          onNavigate={handleNavigateToc}
        />
      ) : null}

      <div
        className="rich-markdown-editor-shell"
        style={{ '--editor-font-zoom-level': fontZoomLevel } as React.CSSProperties}
      >
        <RichMarkdownToolbar
          editor={editor}
          onToggleLink={openLinkEditor}
          onImagePick={handleImagePick}
        />

        <div className="relative min-h-0 flex-1">
          {isSearchOpen ? (
            <div
              className="markdown-preview-search"
              style={{ position: 'absolute', top: 0, right: 20, marginRight: 0 }}
            >
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
                  placeholder="Find in editor…"
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

          <div
            ref={scrollContainerRef}
            className="relative h-full overflow-auto scrollbar-editor [overflow-anchor:none]"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                editor?.commands.focus('end')
              }
            }}
          >
            {frontMatterText ? (
              <div
                style={{
                  paddingLeft: 'var(--rich-md-pad-start)',
                  paddingRight: 'max(var(--rich-md-pad-end), 100% - var(--rich-md-measure) - var(--rich-md-pad-start))',
                  paddingTop: '18px'
                }}
              >
                <details className="orca-frontmatter-card">
                  <summary className="orca-frontmatter-summary">Frontmatter (preserved on save)</summary>
                  <pre className="orca-frontmatter-pre">{frontMatterText}</pre>
                </details>
              </div>
            ) : null}
            <EditorContent editor={editor} />
            <RichMarkdownTableControls editor={editor} scrollContainerRef={scrollContainerRef} />
          </div>
        </div>
      </div>

      {slashMenu ? (
        <RichMarkdownSlashMenu
          menu={slashMenu}
          commands={filteredSlashCommands}
          selectedIndex={selectedSlashIndex}
          onSelect={executeSlashCommand}
        />
      ) : null}

      {linkBubble && editor ? (
        <RichMarkdownLinkBubble
          href={linkBubble.href}
          left={linkBubble.left}
          top={linkBubble.top}
          initialEditing={linkBubble.initialEditing}
          onSave={(nextHref) => {
            editor.chain().focus().extendMarkRange('link').setLink({ href: nextHref }).run()
            setLinkBubble(null)
          }}
          onRemove={() => {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            setLinkBubble(null)
          }}
          onOpen={(url) => {
            openLinkHref(url)
            setLinkBubble(null)
          }}
          onClose={() => setLinkBubble(null)}
        />
      ) : null}
    </div>
  )
}
