import { Hash, Lock, Users } from 'lucide-react'

import { cn } from '../../../lib/cn'
import type { Channel, OnlineAdmin } from '../data/mockChat'

type Props = {
  channels: Channel[]
  activeChannelId: string
  onSelectChannel: (id: string) => void
  admins: OnlineAdmin[]
}

export function ChannelList({
  channels,
  activeChannelId,
  onSelectChannel,
  admins,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Channels */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">
            Channels
          </span>
        </div>

        <div className="space-y-0.5">
          {channels.map((channel) => {
            const isActive = channel.id === activeChannelId
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => onSelectChannel(channel.id)}
                className={cn(
                  'w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors text-left',
                  isActive
                    ? 'bg-emerald-light text-emerald-dark font-semibold'
                    : 'text-ink-secondary hover:bg-surface-alt hover:text-ink',
                )}
              >
                {channel.isPrivate ? (
                  <Lock size={14} className="flex-shrink-0" />
                ) : (
                  <Hash size={14} className="flex-shrink-0" />
                )}
                <span className="flex-1 truncate">{channel.name}</span>
                {channel.unread > 0 ? (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-danger text-white text-[10px] font-bold px-1">
                    {channel.unread}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {/* Online admins */}
        <div className="flex items-center gap-2 px-2 mt-6 mb-2">
          <Users size={11} className="text-ink-muted" />
          <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">
            Online — {admins.filter((a) => a.status === 'online').length}
          </span>
        </div>

        <div className="space-y-0.5">
          {admins.map((admin) => (
            <div
              key={admin.id}
              className="flex items-center gap-2 px-2.5 py-1.5 text-sm"
            >
              <div className="relative flex-shrink-0">
                <div className="w-6 h-6 rounded-full bg-navy text-white flex items-center justify-center text-[10px] font-bold">
                  {admin.initials}
                </div>
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-surface',
                    admin.status === 'online' ? 'bg-emerald' : 'bg-warning',
                  )}
                />
              </div>
              <span className="text-ink-secondary text-xs truncate">
                {admin.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}