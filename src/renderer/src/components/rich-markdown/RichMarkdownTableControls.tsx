import React, { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Columns2, Rows2, Trash2 } from 'lucide-react'

export function RichMarkdownTableControls({
  editor,
  scrollContainerRef
}: {
  editor: Editor | null
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}): React.JSX.Element | null {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!editor) return

    const update = (): void => {
      const container = scrollContainerRef.current
      if (!container || !editor.isActive('table')) {
        setPos(null)
        return
      }
      const domPos = editor.view.domAtPos(editor.state.selection.from)
      const el =
        domPos.node instanceof Element ? domPos.node : domPos.node.parentElement
      const table = el?.closest('table')
      if (!table) {
        setPos(null)
        return
      }
      const tableRect = table.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      setPos({
        top: Math.max(8, tableRect.top - containerRect.top + container.scrollTop - 36),
        left: Math.max(8, tableRect.left - containerRect.left + container.scrollLeft)
      })
    }

    update()
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
    }
  }, [editor, scrollContainerRef])

  if (!editor || !pos) return null

  return (
    <div
      className="orca-table-controls-bar"
      style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}>
        <Rows2 className="size-3" /> +Row
      </button>
      <button type="button" onClick={() => editor.chain().focus().deleteRow().run()}>
        −Row
      </button>
      <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}>
        <Columns2 className="size-3" /> +Col
      </button>
      <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()}>
        −Col
      </button>
      <button
        type="button"
        className="danger"
        onClick={() => editor.chain().focus().deleteTable().run()}
        title="Delete table"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  )
}
