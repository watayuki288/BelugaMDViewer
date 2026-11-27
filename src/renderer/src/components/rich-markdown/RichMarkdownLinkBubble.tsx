import React, { useEffect, useRef, useState } from 'react'
import { Check, Copy, ExternalLink, Pencil, Trash2, X } from 'lucide-react'

export function RichMarkdownLinkBubble({
  href,
  left,
  top,
  initialEditing,
  onSave,
  onRemove,
  onOpen,
  onClose
}: {
  href: string
  left: number
  top: number
  initialEditing: boolean
  onSave: (nextHref: string) => void
  onRemove: () => void
  onOpen: (url: string) => void
  onClose: () => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(initialEditing)
  const [value, setValue] = useState(href)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(href)
    setEditing(initialEditing)
  }, [href, initialEditing])

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [editing])

  const submit = (): void => {
    const trimmed = value.trim()
    if (!trimmed) {
      onRemove()
    } else {
      onSave(trimmed)
    }
  }

  return (
    <div
      className="fixed z-50 flex items-center gap-1 rounded-lg border border-border bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-xl"
      style={{
        left: `${Math.max(12, Math.min(window.innerWidth - 340, left))}px`,
        top: `${Math.max(12, Math.min(window.innerHeight - 60, top))}px`
      }}
    >
      {editing ? (
        <>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
              }
            }}
            placeholder="https://example.com"
            className="h-6 w-56 rounded border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-ring"
          />
          <button
            type="button"
            onClick={submit}
            title="Apply link"
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent text-foreground cursor-pointer"
          >
            <Check className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Cancel"
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent text-muted-foreground cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onOpen(href)}
            title={href}
            className="max-w-52 truncate px-1 text-left text-callout-note hover:underline cursor-pointer"
          >
            {href}
          </button>
          <button
            type="button"
            onClick={() => onOpen(href)}
            title="Open link"
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ExternalLink className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              void window.api.writeClipboardText(href)
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1200)
            }}
            title="Copy URL"
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Edit link"
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="Remove link"
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent text-destructive cursor-pointer"
          >
            <Trash2 className="size-3.5" />
          </button>
        </>
      )}
    </div>
  )
}
