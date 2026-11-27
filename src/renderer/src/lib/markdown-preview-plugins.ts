import type { Options as ReactMarkdownOptions } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import remarkBreaks from 'remark-breaks'
import remarkCjkFriendly from 'remark-cjk-friendly/parseOnly'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { GITHUB_CALLOUT_SANITIZE_ATTRIBUTE } from '@shared/github-callouts'
import { remarkGitHubCallouts } from './remark-github-callouts'
import { MARKDOWN_CODE_LANGUAGES } from './markdown-code-languages'

export const MARKDOWN_PREVIEW_HTML_ID_PREFIX = 'user-content-'

const markdownPreviewSanitizeSchema = {
  ...defaultSchema,
  clobberPrefix: MARKDOWN_PREVIEW_HTML_ID_PREFIX,
  tagNames: [...(defaultSchema.tagNames ?? []), 'details', 'summary', 'kbd', 'sub', 'sup', 'ins'],
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), 'file'],
    src: [...(defaultSchema.protocols?.src ?? []), 'file']
  },
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'id'],
    a: [...(defaultSchema.attributes?.a ?? []), 'href', 'title'],
    blockquote: [
      ...(defaultSchema.attributes?.blockquote ?? []),
      GITHUB_CALLOUT_SANITIZE_ATTRIBUTE
    ],
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ['className', /^language-[\w-]+$/, 'math-inline', 'math-display']
    ],
    div: [...(defaultSchema.attributes?.div ?? []), ['className', /^language-[\w-]+$/], 'align'],
    details: [
      ...(defaultSchema.attributes?.details ?? []),
      'open',
      ['className', 'orca-details'],
      ['dataOrcaToggle', 'heading-1', 'heading-2', 'heading-3', 'heading-4', 'heading-5']
    ],
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'id'],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'id'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'id'],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'id'],
    h5: [...(defaultSchema.attributes?.h5 ?? []), 'id'],
    h6: [...(defaultSchema.attributes?.h6 ?? []), 'id'],
    img: [...(defaultSchema.attributes?.img ?? []), 'src', 'alt', 'title', 'width', 'height'],
    input: [...(defaultSchema.attributes?.input ?? []), 'type', 'checked', 'disabled'],
    pre: [...(defaultSchema.attributes?.pre ?? []), ['className', /^language-[\w-]+$/]],
    span: [...(defaultSchema.attributes?.span ?? []), ['className', /^hljs(?:-[\w-]+)?$/]],
    td: [...(defaultSchema.attributes?.td ?? []), 'align'],
    th: [...(defaultSchema.attributes?.th ?? []), 'align']
  }
}

type MarkdownPluginList = NonNullable<ReactMarkdownOptions['remarkPlugins']>

export const MARKDOWN_REMARK_PLUGINS: MarkdownPluginList = [
  remarkGfm,
  remarkCjkFriendly,
  remarkGitHubCallouts,
  remarkBreaks,
  remarkFrontmatter,
  remarkMath
]

export const MARKDOWN_REHYPE_PLUGINS: MarkdownPluginList = [
  rehypeRaw,
  [rehypeSanitize, markdownPreviewSanitizeSchema],
  rehypeSlug,
  [rehypeHighlight, { languages: MARKDOWN_CODE_LANGUAGES }],
  rehypeKatex
]

export function markdownPreviewUrlTransform(url: string): string {
  const trimmed = url.trim()
  if (/^(https?:|mailto:|file:|data:image\/|#|\.|\/)/i.test(trimmed)) {
    return trimmed
  }
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed
  }
  return ''
}
