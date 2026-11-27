import React from 'react'
import type { Editor } from '@tiptap/react'
import {
  ChevronRight,
  Code2,
  GitBranch,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Pilcrow,
  Quote,
  Sigma,
  Table
} from 'lucide-react'

export interface SlashMenuState {
  query: string
  from: number
  to: number
  left: number
  top: number
}

export interface SlashCommandItem {
  id: string
  label: string
  description: string
  aliases: string[]
  icon: React.ComponentType<{ className?: string }>
  run: (editor: Editor, onImagePick: () => void) => void
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: 'text',
    label: 'Text',
    description: 'Plain paragraph text',
    aliases: ['p', 'paragraph', 'body'],
    icon: Pilcrow,
    run: (editor) => editor.chain().focus().setParagraph().run()
  },
  {
    id: 'h1',
    label: 'Heading 1',
    description: 'Large section heading',
    aliases: ['h1', 'title'],
    icon: Heading1,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run()
  },
  {
    id: 'h2',
    label: 'Heading 2',
    description: 'Medium section heading',
    aliases: ['h2', 'subtitle'],
    icon: Heading2,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run()
  },
  {
    id: 'h3',
    label: 'Heading 3',
    description: 'Small section heading',
    aliases: ['h3'],
    icon: Heading3,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run()
  },
  {
    id: 'bullet',
    label: 'Bullet List',
    description: 'Unordered list',
    aliases: ['ul', 'list', 'bullet'],
    icon: List,
    run: (editor) => editor.chain().focus().toggleBulletList().run()
  },
  {
    id: 'ordered',
    label: 'Numbered List',
    description: 'Ordered list',
    aliases: ['ol', 'number'],
    icon: ListOrdered,
    run: (editor) => editor.chain().focus().toggleOrderedList().run()
  },
  {
    id: 'todo',
    label: 'Checklist',
    description: 'Task list with checkboxes',
    aliases: ['task', 'checkbox', 'todo'],
    icon: ListTodo,
    run: (editor) => editor.chain().focus().toggleTaskList().run()
  },
  {
    id: 'quote',
    label: 'Blockquote',
    description: 'Quoted text block',
    aliases: ['blockquote', 'callout'],
    icon: Quote,
    run: (editor) => editor.chain().focus().toggleBlockquote().run()
  },
  {
    id: 'code',
    label: 'Code Block',
    description: 'Syntax-highlighted code block',
    aliases: ['codeblock', 'fence', 'pre'],
    icon: Code2,
    run: (editor) => editor.chain().focus().toggleCodeBlock().run()
  },
  {
    id: 'mermaid',
    label: 'Mermaid Diagram',
    description: 'Flowchart, sequence, or architecture diagram',
    aliases: ['diagram', 'chart', 'graph'],
    icon: GitBranch,
    run: (editor) =>
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'codeBlock',
          attrs: { language: 'mermaid' },
          content: [{ type: 'text', text: 'flowchart LR\n  A[Start] --> B[Done]' }]
        })
        .run()
  },
  {
    id: 'table',
    label: 'Table',
    description: '3×3 table with header row',
    aliases: ['grid'],
    icon: Table,
    run: (editor) =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  },
  {
    id: 'math',
    label: 'Math Block',
    description: 'KaTeX display equation',
    aliases: ['latex', 'katex', 'equation'],
    icon: Sigma,
    run: (editor) => editor.chain().focus().insertBlockMath({ latex: 'E = mc^2' }).run()
  },
  {
    id: 'toggle',
    label: 'Collapsible Section',
    description: 'Expandable <details> block',
    aliases: ['details', 'accordion', 'collapse'],
    icon: ChevronRight,
    run: (editor) => editor.chain().focus().setDetails().run()
  },
  {
    id: 'divider',
    label: 'Divider',
    description: 'Horizontal rule',
    aliases: ['hr', 'line', 'rule'],
    icon: Minus,
    run: (editor) => editor.chain().focus().setHorizontalRule().run()
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Insert local image file',
    aliases: ['img', 'photo', 'picture'],
    icon: ImageIcon,
    run: (_editor, onImagePick) => onImagePick()
  }
]

export function filterSlashCommands(query: string): SlashCommandItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.aliases.some((a) => a.includes(q))
  )
}

export function RichMarkdownSlashMenu({
  menu,
  commands,
  selectedIndex,
  onSelect
}: {
  menu: SlashMenuState
  commands: SlashCommandItem[]
  selectedIndex: number
  onSelect: (cmd: SlashCommandItem) => void
}): React.JSX.Element {
  return (
    <div
      className="rich-markdown-slash-menu fixed z-50 w-64 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
      style={{
        left: `${Math.max(12, Math.min(window.innerWidth - 270, menu.left))}px`,
        top: `${Math.max(12, Math.min(window.innerHeight - 300, menu.top))}px`
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {commands.length === 0 ? (
        <div className="px-2.5 py-2 text-xs text-muted-foreground">No matching blocks</div>
      ) : (
        commands.map((cmd, idx) => {
          const Icon = cmd.icon
          const selected = idx === selectedIndex
          return (
            <button
              key={cmd.id}
              type="button"
              onClick={() => onSelect(cmd)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs cursor-pointer ${
                selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border bg-background text-muted-foreground">
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">{cmd.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {cmd.description}
                </span>
              </span>
            </button>
          )
        })
      )}
    </div>
  )
}
