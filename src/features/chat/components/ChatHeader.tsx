import { Hash, Lock, Video, Phone, Info } from 'lucide-react'

import type { Channel } from '../data/mockChat'

type Props = {
  channel: Channel
  onStartMeeting: () => void
}

export function ChatHeader({ channel, onStartMeeting }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border bg-surface">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-emerald-light flex items-center justify-center text-emerald flex-shrink-0">
          {channel.isPrivate ? <Lock size={15} /> : <Hash size={15} />}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-ink text-sm truncate">
            {channel.name}
          </div>
          <div className="text-[11px] text-ink-secondary truncate">
            {channel.description}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className="p-2 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
          aria-label="Start voice call"
          title="Voice call (coming soon)"
          disabled
        >
          <Phone size={16} />
        </button>
        <button
          type="button"
          onClick={onStartMeeting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald px-3 py-2 text-white text-xs font-semibold hover:bg-emerald-dark transition-colors"
          title="Start a Google Meet"
        >
          <Video size={14} />
          <span className="hidden sm:inline">Start meeting</span>
        </button>
        <button
          type="button"
          className="p-2 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
          aria-label="Channel info"
        >
          <Info size={16} />
        </button>
      </div>
    </div>
  )
}