import { FileText, Image as ImageIcon, Download } from 'lucide-react'

import { cn } from '../../../lib/cn'
import type { ChatMessage } from '../data/mockChat'

type Props = {
  message: ChatMessage
  isMine: boolean
  showAuthor: boolean
}

function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function MessageBubble({ message, isMine, showAuthor }: Props) {
  return (
    <div className={cn('flex gap-2.5 mb-3', isMine ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar (only show when author changes) */}
      <div className={cn('w-8 flex-shrink-0', showAuthor ? '' : 'opacity-0')}>
        <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-[11px] font-bold">
          {message.authorInitials}
        </div>
      </div>

      <div className={cn('max-w-[70%] flex flex-col', isMine ? 'items-end' : 'items-start')}>
        {showAuthor ? (
          <div className="flex items-baseline gap-2 mb-1 px-1">
            <span className="text-xs font-semibold text-ink">
              {isMine ? 'You' : message.authorName}
            </span>
            <span className="text-[10px] text-ink-muted">
              {timeOnly(message.createdAt)}
            </span>
          </div>
        ) : null}

        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words',
            isMine
              ? 'bg-emerald text-white rounded-tr-sm'
              : 'bg-surface border border-border text-ink rounded-tl-sm',
          )}
        >
          {message.body}
        </div>

        {message.attachment ? (
          <div
            className={cn(
              'mt-1.5 flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs',
              isMine
                ? 'bg-emerald-light/40 border-emerald/30'
                : 'bg-surface-alt border-border',
            )}
          >
            <div className="w-8 h-8 rounded-md bg-surface flex items-center justify-center flex-shrink-0">
              {message.attachment.type === 'image' ? (
                <ImageIcon size={14} className="text-emerald" />
              ) : (
                <FileText size={14} className="text-emerald" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink truncate">
                {message.attachment.name}
              </div>
              <div className="text-[10px] text-ink-muted">
                {message.attachment.size}
              </div>
            </div>
            <Download size={14} className="text-ink-muted flex-shrink-0" />
          </div>
        ) : null}
      </div>
    </div>
  )
}