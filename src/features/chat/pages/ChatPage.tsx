import { useEffect, useRef } from 'react'
import { Hash } from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { EmptyState } from '../../../components/shared/EmptyState'
import { ChannelList } from '../components/ChannelList'
import { ChatHeader } from '../components/ChatHeader'
import { MessageBubble } from '../components/MessageBubble'
import { MessageComposer } from '../components/MessageComposer'
import { useChat } from '../hooks/useChat'
import { useAuth } from '../../../store/AuthContext'

export function ChatPage() {
  const { user } = useAuth()
  const {
    channels,
    admins,
    activeChannel,
    activeMessages,
    selectChannel,
    sendMessage,
  } = useChat()

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [activeMessages.length, activeChannel.id])

  const handleStartMeeting = () => {
    window.open('https://meet.google.com/new', '_blank', 'noopener,noreferrer')
  }

  return (
    <AppShell title="Team Chat">
      <div className="h-[calc(100vh-10rem)] rounded-xl bg-surface border border-border overflow-hidden flex">
        <div className="hidden md:flex md:w-64 border-r border-border flex-col bg-surface-alt/40">
          <ChannelList
            channels={channels}
            activeChannelId={activeChannel.id}
            onSelectChannel={selectChannel}
            admins={admins}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <ChatHeader
            channel={activeChannel}
            onStartMeeting={handleStartMeeting}
          />

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-5 py-4 bg-canvas"
          >
            {activeMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <EmptyState
                  icon={Hash}
                  title={`Welcome to #${activeChannel.name}`}
                  description={activeChannel.description}
                />
              </div>
            ) : (
              activeMessages.map((msg, i) => {
                const prev = activeMessages[i - 1]
                const showAuthor =
                  !prev ||
                  prev.authorId !== msg.authorId ||
                  new Date(msg.createdAt).getTime() -
                    new Date(prev.createdAt).getTime() >
                    5 * 60 * 1000

                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isMine={msg.authorId === user?.id}
                    showAuthor={showAuthor}
                  />
                )
              })
            )}
          </div>

          <MessageComposer onSend={sendMessage} />
        </div>
      </div>
    </AppShell>
  )
}