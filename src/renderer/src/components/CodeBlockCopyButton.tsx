import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

type CodeBlockCopyButtonProps = React.HTMLAttributes<HTMLPreElement> & {
  children?: React.ReactNode
  wrapInPre?: boolean
}

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join('')
  }
  if (React.isValidElement(node) && node.props) {
    const props = node.props as { children?: React.ReactNode }
    return extractText(props.children)
  }
  return ''
}

export function CodeBlockCopyButton({
  children,
  wrapInPre = true,
  ...props
}: CodeBlockCopyButtonProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  const handleCopy = useCallback(() => {
    const text = extractText(children).replace(/\r\n/g, '\n').replace(/\n$/, '')
    void window.api.writeClipboardText(text).then(() => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      setCopied(true)
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        setCopied(false)
      }, 1500)
    })
  }, [children])

  return (
    <div
      className={wrapInPre ? 'code-block-wrapper' : 'code-block-wrapper code-block-wrapper-diagram'}
    >
      {wrapInPre ? <pre {...props}>{children}</pre> : children}
      <button
        type="button"
        className="code-block-copy-btn"
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
    </div>
  )
}
