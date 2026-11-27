import type React from 'react'
import {
  Info,
  Lightbulb,
  MessageSquareWarning,
  OctagonAlert,
  TriangleAlert,
  type LucideIcon
} from 'lucide-react'
import { cn } from '@/lib/cn'
import type { GitHubCalloutKind } from '@shared/github-callouts'

const CALLOUT_PRESENTATIONS: Record<
  GitHubCalloutKind,
  { Icon: LucideIcon; label: string; borderClassName: string; titleClassName: string }
> = {
  note: {
    Icon: Info,
    label: 'Note',
    borderClassName: 'border-callout-note',
    titleClassName: 'text-callout-note'
  },
  tip: {
    Icon: Lightbulb,
    label: 'Tip',
    borderClassName: 'border-status-success',
    titleClassName: 'text-status-success'
  },
  important: {
    Icon: MessageSquareWarning,
    label: 'Important',
    borderClassName: 'border-callout-important',
    titleClassName: 'text-callout-important'
  },
  warning: {
    Icon: TriangleAlert,
    label: 'Warning',
    borderClassName: 'border-status-warning',
    titleClassName: 'text-status-warning'
  },
  caution: {
    Icon: OctagonAlert,
    label: 'Caution',
    borderClassName: 'border-destructive',
    titleClassName: 'text-destructive'
  }
}

export function MarkdownGitHubCallout({
  kind,
  className,
  children,
  ...rest
}: {
  kind: GitHubCalloutKind
  className?: string
  children?: React.ReactNode
} & React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  const { Icon, label, borderClassName, titleClassName } = CALLOUT_PRESENTATIONS[kind]
  return (
    <div {...rest} role="note" data-callout={kind} className={cn(borderClassName, className)}>
      <div className={cn('flex items-center gap-1.5 font-medium', titleClassName)}>
        <Icon aria-hidden className="size-[1em] shrink-0" />
        {label}
      </div>
      {children}
    </div>
  )
}
