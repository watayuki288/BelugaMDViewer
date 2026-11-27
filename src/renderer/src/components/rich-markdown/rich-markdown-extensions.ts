import { Extension, mergeAttributes, type AnyExtension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Code } from '@tiptap/extension-code'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { TaskList } from '@tiptap/extension-list'
import { TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { BlockMath, InlineMath } from '@tiptap/extension-mathematics'
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details'
import { Markdown } from '@tiptap/markdown'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { createLowlight } from 'lowlight'
import { MARKDOWN_CODE_LANGUAGES } from '@/lib/markdown-code-languages'
import { resolveLocalImageSrc } from '@/lib/local-image-cache'
import type { RenderedMermaidDiagram } from '@/lib/mermaid/MermaidBlock'
import { RichMarkdownCodeBlockLowlight } from './rich-markdown-lowlight'
import { RichMarkdownCodeBlock } from './RichMarkdownCodeBlock'
import { RichMarkdownTable } from './rich-markdown-table'
import { RichMarkdownTaskItem } from './rich-markdown-task-item'

const richMarkdownLowlight = createLowlight(MARKDOWN_CODE_LANGUAGES)

const RichMarkdownCode = Code.extend({
  excludes: 'code bold italic strike underline'
})

const OrcaMetaStorage = Extension.create({
  name: 'orcaMeta',
  addStorage() {
    return {
      filePath: '' as string,
      onExpandMermaid: undefined as ((d: RenderedMermaidDiagram) => void) | undefined
    }
  }
})

const LocalAwareImage = Image.extend({
  addNodeView() {
    return ({ node, HTMLAttributes, editor }) => {
      const dom = document.createElement('span')
      dom.style.display = 'inline'
      dom.style.lineHeight = '0'

      const img = document.createElement('img')
      img.draggable = false
      img.style.display = 'inline-block'
      img.style.verticalAlign = 'baseline'

      const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'src' || v == null || v === false) continue
        img.setAttribute(k, String(v))
      }
      dom.appendChild(img)

      let currentSrc = node.attrs.src as string | undefined
      const load = (src: string | undefined): void => {
        const meta = (editor.storage as unknown as { orcaMeta?: { filePath?: string } }).orcaMeta
        if (!src) {
          img.removeAttribute('src')
          return
        }
        if (/^(https?:|data:|blob:)/i.test(src)) {
          img.src = src
          return
        }
        void resolveLocalImageSrc(src, meta?.filePath || undefined).then((resolved) => {
          if (currentSrc !== src) return
          if (resolved) {
            img.src = resolved
          } else {
            img.src = src
          }
        })
      }

      load(currentSrc)

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'image') return false
          const nextSrc = updatedNode.attrs.src as string | undefined
          if (updatedNode.attrs.alt != null) img.alt = String(updatedNode.attrs.alt)
          if (updatedNode.attrs.title != null) img.title = String(updatedNode.attrs.title)
          if (nextSrc !== currentSrc) {
            currentSrc = nextSrc
            load(nextSrc)
          }
          return true
        }
      }
    }
  }
})

export function createRichMarkdownExtensions(): AnyExtension[] {
  return [
    OrcaMetaStorage,
    StarterKit.configure({
      link: false,
      code: false,
      codeBlock: false,
      undoRedo: {
        depth: 200,
        newGroupDelay: 400
      }
    }),
    RichMarkdownCode,
    RichMarkdownCodeBlockLowlight.extend({
      addNodeView() {
        return ReactNodeViewRenderer(RichMarkdownCodeBlock)
      }
    }).configure({
      lowlight: richMarkdownLowlight,
      defaultLanguage: null
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true
    }),
    LocalAwareImage.configure({
      allowBase64: true,
      inline: true
    }),
    TaskList,
    RichMarkdownTaskItem.configure({
      nested: true
    }),
    Details.configure({
      persist: true,
      HTMLAttributes: { class: 'orca-details' }
    }),
    DetailsSummary,
    DetailsContent,
    RichMarkdownTable.configure({
      resizable: false
    }),
    TableRow,
    TableHeader,
    TableCell,
    InlineMath.configure({
      katexOptions: { throwOnError: false }
    }),
    BlockMath.configure({
      katexOptions: { displayMode: true, throwOnError: false }
    }),
    Placeholder.configure({
      includeChildren: true,
      placeholder: ({ node }) =>
        node.type.name === 'detailsSummary'
          ? 'Toggle title…'
          : 'Write markdown… Type / for blocks.'
    }),
    Markdown.configure({
      markedOptions: {
        gfm: true
      }
    })
  ]
}
