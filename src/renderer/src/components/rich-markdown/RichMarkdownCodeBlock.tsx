import React, { useCallback, useEffect, useRef, useState } from 'react'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Check, Copy } from 'lucide-react'
import { MermaidBlock, type RenderedMermaidDiagram } from '@/lib/mermaid/MermaidBlock'

const CODE_LANGUAGES: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'Plain text' },
  { value: 'bash', label: 'Bash' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'css', label: 'CSS' },
  { value: 'diff', label: 'Diff' },
  { value: 'go', label: 'Go' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'html', label: 'HTML' },
  { value: 'java', label: 'Java' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'mermaid', label: 'Mermaid' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'python', label: 'Python' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'rust', label: 'Rust' },
  { value: 'scss', label: 'SCSS' },
  { value: 'shell', label: 'Shell' },
  { value: 'sql', label: 'SQL' },
  { value: 'swift', label: 'Swift' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'xml', label: 'XML' },
  { value: 'yaml', label: 'YAML' }
]

const KNOWN_LANGUAGES = new Set(CODE_LANGUAGES.map((l) => l.value))

export function RichMarkdownCodeBlock({
  node,
  updateAttributes,
  editor
}: NodeViewProps): React.JSX.Element {
  const language = (node.attrs.language as string) || ''
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)
  const isDark = document.documentElement.classList.contains('dark')
  const isMermaid = language === 'mermaid'

  const expandMermaid = (
    editor.storage as unknown as {
      orcaMeta?: { onExpandMermaid?: (d: RenderedMermaidDiagram) => void }
    }
  ).orcaMeta?.onExpandMermaid

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const text = node.textContent.replace(/\r\n/g, '\n')
      void window.api.writeClipboardText(text).then(() => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current)
        setCopied(true)
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null
          setCopied(false)
        }, 1500)
      })
    },
    [node]
  )

  return (
    <NodeViewWrapper className="rich-markdown-code-block-wrapper">
      <select
        className="rich-markdown-code-block-lang"
        contentEditable={false}
        value={language}
        onChange={(e) => updateAttributes({ language: e.target.value })}
      >
        {CODE_LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
        {language && !KNOWN_LANGUAGES.has(language) ? (
          <option value={language}>{language}</option>
        ) : null}
      </select>
      <button
        type="button"
        className="code-block-copy-btn"
        contentEditable={false}
        onClick={handleCopy}
        aria-label="Copy code"
        title="Copy code"
      >
        {copied ? (
          <>
            <Check size={14} />
            <span className="code-block-copy-label">Copied</span>
          </>
        ) : (
          <Copy size={14} />
        )}
      </button>
      <NodeViewContent<'pre'> as="pre" />
      {isMermaid && node.textContent.trim() ? (
        <div contentEditable={false} className="mermaid-preview">
          <MermaidBlock
            content={node.textContent.trim()}
            isDark={isDark}
            onExpand={expandMermaid}
          />
        </div>
      ) : null}
    </NodeViewWrapper>
  )
}
