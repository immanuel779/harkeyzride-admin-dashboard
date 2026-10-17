import { useState } from 'react'
import { Hash, Lock, Video, Phone, Info, Menu, X } from 'lucide-react'

import type { Channel } from '../data/mockChat'
import { ChannelList } from './ChannelList'
import type { OnlineAdmin } from '../data/mockChat'

type Props = {
  channel: Channel
  onStartMeeting: () => void
  channels: Channel[]
  admins: OnlineAdmin[]
  onSelectChannel: (id: string) => void
}

export function ChatHeader({
  channel,
  onStartMeeting,
  channels,
  admins,
  onSelectChannel,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleSelect = (id: string) => {
    onSelectChannel(id)
    setDrawerOpen(false)
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3.5 border-b border-border bg-surface">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile channel toggle */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="md:hidden p-2 -ml-2 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
            aria-label="Open channels list"
          >
            <Menu size={18} aria-hidden="true" />
          </button>

          <div
            className="w-8 h-8 rounded-lg bg-emerald-light flex items-center justify-center text-emerald flex-shrink-0"
            aria-hidden="true"
          >
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
            className="hidden md:inline-flex p-2 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
            aria-label="Voice call (coming soon)"
            disabled
          >
            <Phone size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onStartMeeting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald px-3 py-2 text-white text-xs font-semibold hover:bg-emerald-dark transition-colors"
            title="Start a Google Meet"
            aria-label="Start a Google Meet"
          >
            <Video size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Start meeting</span>
          </button>
          <button
            type="button"
            className="hidden md:inline-flex p-2 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
            aria-label="Channel info"
          >
            <Info size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile channel drawer */}
      {drawerOpen ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed inset-y-0 left-0 z-50 w-64 md:hidden bg-surface-alt flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Channels"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
              <span className="text-sm font-semibold text-ink">Channels</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
                aria-label="Close channels"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChannelList
                channels={channels}
                activeChannelId={channel.id}
                onSelectChannel={handleSelect}
                admins={admins}
              />
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}