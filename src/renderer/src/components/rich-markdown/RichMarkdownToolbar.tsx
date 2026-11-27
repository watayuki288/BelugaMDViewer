import React from 'react'
import type { Editor } from '@tiptap/react'
import {
  ChevronRight,
  Code,
  Code2,
  GitBranch,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Sigma,
  Table,
  Undo2
} from 'lucide-react'

function ToolbarButton({
  active = false,
  disabled = false,
  label,
  onClick,
  children
}: {
  active?: boolean
  disabled?: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`rich-markdown-toolbar-button ${
        disabled ? 'opacity-35 cursor-default pointer-events-none' : 'cursor-pointer'
      } ${active ? 'is-active' : ''}`}
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function Separator(): React.JSX.Element {
  return <div className="rich-markdown-toolbar-separator" />
}

export function RichMarkdownToolbar({
  editor,
  onToggleLink,
  onImagePick
}: {
  editor: Editor | null
  onToggleLink: () => void
  onImagePick: () => void
}): React.JSX.Element {
  const canUndo = Boolean(editor?.can().undo())
  const canRedo = Boolean(editor?.can().redo())

  return (
    <div className="rich-markdown-editor-toolbar overflow-x-auto">
      <ToolbarButton
        disabled={!canUndo}
        label="元に戻す / Undo (Ctrl+Z)"
        onClick={() => editor?.chain().focus().undo().run()}
      >
        <Undo2 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        disabled={!canRedo}
        label="やり直す / Redo (Ctrl+Y)"
        onClick={() => editor?.chain().focus().redo().run()}
      >
        <Redo2 className="size-3.5" />
      </ToolbarButton>

      <Separator />

      <ToolbarButton
        active={Boolean(editor?.isActive('paragraph'))}
        label="Body text"
        onClick={() => editor?.chain().focus().setParagraph().run()}
      >
        <Pilcrow className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={Boolean(editor?.isActive('heading', { level: 1 }))}
        label="Heading 1"
        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={Boolean(editor?.isActive('heading', { level: 2 }))}
        label="Heading 2"
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={Boolean(editor?.isActive('heading', { level: 3 }))}
        label="Heading 3"
        onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="size-3.5" />
      </ToolbarButton>

      <Separator />

      <ToolbarButton
        active={Boolean(editor?.isActive('bold'))}
        label="Bold (Ctrl+B)"
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        B
      </ToolbarButton>
      <ToolbarButton
        active={Boolean(editor?.isActive('italic'))}
        label="Italic (Ctrl+I)"
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        active={Boolean(editor?.isActive('strike'))}
        label="Strikethrough"
        onClick={() => editor?.chain().focus().toggleStrike().run()}
      >
        <span className="line-through">S</span>
      </ToolbarButton>
      <ToolbarButton
        active={Boolean(editor?.isActive('code'))}
        label="Inline code"
        onClick={() => editor?.chain().focus().toggleCode().run()}
      >
        <Code className="size-3.5" />
      </ToolbarButton>

      <Separator />

      <ToolbarButton
        active={Boolean(editor?.isActive('bulletList'))}
        label="Bullet list"
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <List className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={Boolean(editor?.isActive('orderedList'))}
        label="Numbered list"
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={Boolean(editor?.isActive('taskList'))}
        label="Checklist"
        onClick={() => editor?.chain().focus().toggleTaskList().run()}
      >
        <ListTodo className="size-3.5" />
      </ToolbarButton>

      <Separator />

      <ToolbarButton
        active={Boolean(editor?.isActive('blockquote'))}
        label="Blockquote"
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={Boolean(editor?.isActive('codeBlock'))}
        label="Code block"
        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Insert Table"
        onClick={() =>
          editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        <Table className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Insert Mermaid Diagram"
        onClick={() =>
          editor
            ?.chain()
            .focus()
            .insertContent({
              type: 'codeBlock',
              attrs: { language: 'mermaid' },
              content: [{ type: 'text', text: 'flowchart LR\n  A[Start] --> B[End]' }]
            })
            .run()
        }
      >
        <GitBranch className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Insert Math Block"
        onClick={() =>
          editor?.chain().focus().insertBlockMath({ latex: 'E = mc^2' }).run()
        }
      >
        <Sigma className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Collapsible Section"
        onClick={() => editor?.chain().focus().setDetails().run()}
      >
        <ChevronRight className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Horizontal Rule"
        onClick={() => editor?.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="size-3.5" />
      </ToolbarButton>

      <Separator />

      <ToolbarButton
        active={Boolean(editor?.isActive('link'))}
        label="Link (Ctrl+K)"
        onClick={onToggleLink}
      >
        <LinkIcon className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Insert Image" onClick={onImagePick}>
        <ImageIcon className="size-3.5" />
      </ToolbarButton>
    </div>
  )
}
