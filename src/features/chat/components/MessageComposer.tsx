import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Paperclip, Send, Smile, X, FileText, Image as ImageIcon } from 'lucide-react'

type PendingAttachment = {
  name: string
  size: string
  type: 'image' | 'file'
}

type Props = {
  onSend: (body: string, attachment?: PendingAttachment) => void
  disabled?: boolean
}

export function MessageComposer({ onSend, disabled }: Props) {
  const [body, setBody] = useState('')
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!body.trim() && !attachment) return
    onSend(body.trim(), attachment ?? undefined)
    setBody('')
    setAttachment(null)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as FormEvent)
    }
  }

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isImage = file.type.startsWith('image/')
    setAttachment({
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      type: isImage ? 'image' : 'file',
    })
    e.target.value = ''
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-border bg-surface p-3"
    >
      {/* Attachment preview */}
      {attachment ? (
        <div className="mb-2 flex items-center gap-2.5 rounded-lg bg-surface-alt border border-border px-3 py-2">
          <div className="w-8 h-8 rounded-md bg-surface flex items-center justify-center flex-shrink-0">
            {attachment.type === 'image' ? (
              <ImageIcon size={14} className="text-emerald" />
            ) : (
              <FileText size={14} className="text-emerald" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-ink truncate">
              {attachment.name}
            </div>
            <div className="text-[10px] text-ink-muted">{attachment.size}</div>
          </div>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            className="p-1 rounded hover:bg-surface text-ink-muted hover:text-danger transition-colors"
            aria-label="Remove attachment"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFilePick}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-2 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors disabled:opacity-40"
          aria-label="Attach file"
        >
          <Paperclip size={18} />
        </button>

        <div className="flex-1 rounded-xl border border-border bg-canvas focus-within:border-emerald focus-within:ring-2 focus-within:ring-emerald/20 transition-colors">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message #channel — Enter to send, Shift+Enter for new line"
            rows={1}
            disabled={disabled}
            className="w-full bg-transparent px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none resize-none max-h-32"
            style={{ minHeight: '42px' }}
          />
        </div>

        <button
          type="button"
          className="p-2 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
          aria-label="Emoji"
          tabIndex={-1}
        >
          <Smile size={18} />
        </button>

        <button
          type="submit"
          disabled={disabled || (!body.trim() && !attachment)}
          className="p-2.5 rounded-lg bg-emerald text-white hover:bg-emerald-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>
    </form>
  )
}