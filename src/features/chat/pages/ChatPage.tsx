import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Copy,
  Eye,
  File,
  FileJson,
  Filter,
  Hash,
  Image as ImageIcon,
  Info,
  Keyboard,
  Loader2,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  Search,
  Settings,
  Shield,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { EmptyState } from '../../../components/shared/EmptyState'
import { ChannelList } from '../components/ChannelList'
import { ChatHeader } from '../components/ChatHeader'
import { MessageBubble } from '../components/MessageBubble'
import { MessageComposer } from '../components/MessageComposer'
import { useChat } from '../hooks/useChat'
import { useAuth } from '../../../store/AuthContext'

/* ==========================================================================
   TYPES
   ========================================================================== */

type FilterKey = 'all' | 'files' | 'images'

type MatchIndex = {
  messageId: string
  index: number
}

/* ==========================================================================
   HELPERS
   ========================================================================== */

function getMessageDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Unknown'
  return d.toISOString().slice(0, 10)
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Unknown'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const dMidnight = new Date(d)
  dMidnight.setHours(0, 0, 0, 0)

  if (dMidnight.getTime() === today.getTime()) return 'Today'
  if (dMidnight.getTime() === yesterday.getTime()) return 'Yesterday'

  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  if (dMidnight.getTime() >= weekAgo.getTime()) {
    return d.toLocaleDateString(undefined, { weekday: 'long' })
  }

  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year:
      d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

function getMessageText(msg: Record<string, unknown>): string {
  return typeof msg.body === 'string' ? msg.body : ''
}

function getAttachment(
  msg: Record<string, unknown>,
): { name: string; size: string; type: 'image' | 'file' } | null {
  const attachment = msg.attachment as
    | { name?: string; size?: string; type?: 'image' | 'file' }
    | undefined
  if (!attachment || typeof attachment !== 'object') return null
  if (!attachment.name) return null
  return {
    name: attachment.name,
    size: attachment.size ?? '',
    type: attachment.type ?? 'file',
  }
}

function containsLink(text: string): boolean {
  return /https?:\/\/\S+/i.test(text)
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export function ChatPage() {
  const { user } = useAuth()
  const {
    channels,
    admins,
    activeChannel,
    activeMessages,
    selectChannel,
    sendMessage,
    isLoadingChannels,
    isLoadingMessages,
  } = useChat()

  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [showInfo, setShowInfo] = useState(false)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [matchIndex, setMatchIndex] = useState(0)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const copiedTimerRef = useRef<number | null>(null)
  const lastMessageIdRef = useRef<string | null>(null)

  /* ---------------------------- derived ---------------------------- */

  // Cast messages defensively (we don't own the type from useChat)
  const rawMessages = useMemo(
    () => (activeMessages ?? []) as Array<Record<string, unknown>>,
    [activeMessages],
  )

  // Apply attachment filter
  const filterFiltered = useMemo(() => {
    if (filter === 'all') return rawMessages
    if (filter === 'files') {
      return rawMessages.filter((m) => {
        const att = getAttachment(m)
        return att !== null && att.type === 'file'
      })
    }
    if (filter === 'images') {
      return rawMessages.filter((m) => {
        const att = getAttachment(m)
        return att !== null && att.type === 'image'
      })
    }
    return rawMessages
  }, [rawMessages, filter])

  // Apply search filter
  const displayMessages = useMemo(() => {
    if (!search.trim()) return filterFiltered
    const q = search.trim().toLowerCase()
    return filterFiltered.filter((m) => {
      const body = getMessageText(m).toLowerCase()
      const att = getAttachment(m)
      const authorName = String(
        m.authorName ?? m.authorId ?? '',
      ).toLowerCase()
      return (
        body.includes(q) ||
        authorName.includes(q) ||
        (att?.name.toLowerCase().includes(q) ?? false)
      )
    })
  }, [filterFiltered, search])

  // Match navigation — used when search active
  const matches: MatchIndex[] = useMemo(() => {
    return displayMessages.map((m, i) => ({
      messageId: String(m.id),
      index: i,
    }))
  }, [displayMessages])

  const totalMatches = matches.length
  const currentMatch = totalMatches > 0 ? matches[matchIndex % totalMatches] : null

  // Group messages by day for date separators
  const groupedMessages = useMemo(() => {
    const groups: Array<{ day: string; label: string; messages: Array<Record<string, unknown>> }> = []
    let currentDay = ''
    let currentGroup: { day: string; label: string; messages: Array<Record<string, unknown>> } | null = null

    for (const msg of displayMessages) {
      const createdAt = String(msg.createdAt ?? '')
      const day = getMessageDay(createdAt)
      if (day !== currentDay) {
        if (currentGroup) groups.push(currentGroup)
        currentGroup = {
          day,
          label: formatDayLabel(createdAt),
          messages: [],
        }
        currentDay = day
      }
      currentGroup?.messages.push(msg)
    }
    if (currentGroup) groups.push(currentGroup)
    return groups
  }, [displayMessages])

  // Counters for filter pills
  const fileCount = useMemo(
    () =>
      rawMessages.filter((m) => {
        const att = getAttachment(m)
        return att?.type === 'file'
      }).length,
    [rawMessages],
  )
  const imageCount = useMemo(
    () =>
      rawMessages.filter((m) => {
        const att = getAttachment(m)
        return att?.type === 'image'
      }).length,
    [rawMessages],
  )

  /* ---------------------------- effects ---------------------------- */

  // Auto-scroll only when new message arrives AND user is already at bottom
  useEffect(() => {
    if (!scrollRef.current) return
    const lastMsg = displayMessages[displayMessages.length - 1]
    const lastId = lastMsg ? String(lastMsg.id) : null
    const isNewMessage = lastId !== lastMessageIdRef.current
    lastMessageIdRef.current = lastId

    if (!isNewMessage) return

    const el = scrollRef.current
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < 200 || displayMessages.length === 1) {
      el.scrollTop = el.scrollHeight
    }
  }, [displayMessages])

  // Reset scroll-to-bottom indicator on channel change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    setShowScrollToBottom(false)
    setSearch('')
    setMatchIndex(0)
  }, [activeChannel?.id])

  // Cleanup copy timer
  useEffect(
    () => () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
    },
    [],
  )

  // Scroll handler — show/hide jump-to-bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollToBottom(distance > 200)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const inField =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (e.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false)
          return
        }
        if (searchOpen) {
          setSearchOpen(false)
          setSearch('')
          return
        }
        if (showInfo) {
          setShowInfo(false)
          return
        }
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        window.setTimeout(() => searchInputRef.current?.focus(), 50)
        return
      }

      if (e.key === '?' && !inField) {
        e.preventDefault()
        setShowShortcuts((v) => !v)
        return
      }

      if (e.key === '/' && !inField) {
        e.preventDefault()
        setSearchOpen(true)
        window.setTimeout(() => searchInputRef.current?.focus(), 50)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [searchOpen, showInfo, showShortcuts])

  /* ---------------------------- actions ---------------------------- */

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    })
  }, [])

  const handleCopy = useCallback(
    async (value: string, key: string) => {
      try {
        await navigator.clipboard.writeText(value)
        setCopied(key)
        if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
        copiedTimerRef.current = window.setTimeout(() => setCopied(null), 1400)
      } catch {
        /* ignore */
      }
    },
    [],
  )

  const handleCopyConversation = useCallback(async () => {
    if (!activeChannel) return
    const lines = rawMessages.map((m) => {
      const author = String(m.authorName ?? m.authorId ?? 'Unknown')
      const ts = new Date(String(m.createdAt ?? '')).toLocaleString()
      const body = getMessageText(m)
      return `[${ts}] ${author}: ${body}`
    })
    const text = `# ${activeChannel.name}\n\n${lines.join('\n\n')}`
    await handleCopy(text, 'conversation')
  }, [activeChannel, rawMessages, handleCopy])

  const handleExportJSON = useCallback(async () => {
    if (!activeChannel) return
    const payload = {
      channel: activeChannel,
      exportedAt: new Date().toISOString(),
      messageCount: rawMessages.length,
      messages: rawMessages,
    }
    await handleCopy(JSON.stringify(payload, null, 2), 'json')
  }, [activeChannel, rawMessages, handleCopy])

  const nextMatch = () => {
    if (totalMatches === 0) return
    setMatchIndex((i) => (i + 1) % totalMatches)
  }
  const prevMatch = () => {
    if (totalMatches === 0) return
    setMatchIndex((i) => (i - 1 + totalMatches) % totalMatches)
  }

  const handleSend = (
    body: string,
    attachment?: { name: string; size: string; type: 'image' | 'file' },
  ) => {
    void sendMessage(body, attachment)
    // After sending, snap to bottom
    window.setTimeout(() => scrollToBottom(), 80)
  }

  const handleStartMeeting = () => {
    window.open('https://meet.google.com/new', '_blank', 'noopener,noreferrer')
  }

  /* ---------------------------- loading ---------------------------- */

  if (isLoadingChannels && !activeChannel) {
    return (
      <AppShell title="Team Chat">
        <div className="h-[calc(100vh-11rem)] md:h-[calc(100vh-10rem)] rounded-xl bg-surface border border-border overflow-hidden flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-emerald" size={28} />
            <p className="text-xs text-ink-muted">Loading channels…</p>
          </div>
        </div>
      </AppShell>
    )
  }

  if (!activeChannel) {
    return (
      <AppShell title="Team Chat">
        <div className="h-[calc(100vh-11rem)] md:h-[calc(100vh-10rem)] rounded-xl bg-surface border border-border overflow-hidden flex items-center justify-center">
          <EmptyState
            icon={Hash}
            title="No channels available"
            description="Channels will appear here once your team is set up."
          />
        </div>
      </AppShell>
    )
  }

  /* ---------------------------- render ---------------------------- */

  return (
    <AppShell title="Team Chat">
      <div className="h-[calc(100vh-11rem)] md:h-[calc(100vh-10rem)] rounded-xl bg-surface border border-border overflow-hidden flex">
        {/* Desktop sidebar */}
        <div className="hidden md:flex md:w-64 border-r border-border flex-col bg-surface-alt/40">
          <ChannelList
            channels={channels}
            activeChannelId={activeChannel.id}
            onSelectChannel={selectChannel}
            admins={admins}
          />
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          <ChatHeader
            channel={activeChannel}
            onStartMeeting={handleStartMeeting}
            channels={channels}
            admins={admins}
            onSelectChannel={selectChannel}
          />

          {/* Toolbar — search + filters + info */}
          <div className="border-b border-border bg-surface-alt/30 px-3 py-2 flex items-center gap-2">
            {/* Search */}
            {searchOpen ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <div className="relative flex-1 min-w-0">
                  <Search
                    size={12}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setMatchIndex(0)
                    }}
                    placeholder="Search this channel…"
                    className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-16 text-xs text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20"
                  />
                  {totalMatches > 0 ? (
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-ink-muted tabular-nums">
                      {(matchIndex % totalMatches) + 1}/{totalMatches}
                    </span>
                  ) : search ? (
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-ink-muted">
                      No match
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={prevMatch}
                  disabled={totalMatches === 0}
                  className="rounded-md border border-border bg-surface p-1 text-ink-muted hover:border-emerald hover:text-emerald transition-colors disabled:opacity-40"
                  aria-label="Previous match"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={nextMatch}
                  disabled={totalMatches === 0}
                  className="rounded-md border border-border bg-surface p-1 text-ink-muted hover:border-emerald hover:text-emerald transition-colors disabled:opacity-40"
                  aria-label="Next match"
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false)
                    setSearch('')
                  }}
                  className="rounded-md p-1 text-ink-muted hover:bg-surface-alt hover:text-ink transition-colors"
                  aria-label="Close search"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(true)
                    window.setTimeout(
                      () => searchInputRef.current?.focus(),
                      50,
                    )
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:border-emerald hover:text-emerald transition-colors"
                  title="Search (⌘K or /)"
                >
                  <Search size={11} />
                  Search
                  <kbd className="hidden sm:inline rounded border border-border bg-surface-alt px-1 font-mono text-[9px] text-ink-muted">
                    ⌘K
                  </kbd>
                </button>

                {/* Filter pills */}
                <div className="flex items-center gap-1">
                  <FilterPill
                    label="All"
                    count={rawMessages.length}
                    active={filter === 'all'}
                    onClick={() => setFilter('all')}
                  />
                  {imageCount > 0 ? (
                    <FilterPill
                      label="Images"
                      count={imageCount}
                      active={filter === 'images'}
                      onClick={() => setFilter('images')}
                      icon={<ImageIcon size={10} />}
                    />
                  ) : null}
                  {fileCount > 0 ? (
                    <FilterPill
                      label="Files"
                      count={fileCount}
                      active={filter === 'files'}
                      onClick={() => setFilter('files')}
                      icon={<File size={10} />}
                    />
                  ) : null}
                </div>

                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleCopyConversation}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-ink-secondary hover:border-emerald hover:text-emerald transition-colors"
                    title="Copy conversation as text"
                  >
                    {copied === 'conversation' ? (
                      <>
                        <Check size={11} className="text-emerald" />
                        Copied
                      </>
                    ) : (
                      <>
                        <ClipboardCopy size={11} />
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJSON}
                    className="rounded-md border border-border bg-surface p-1 text-ink-muted hover:border-emerald hover:text-emerald transition-colors"
                    title="Copy as JSON"
                    aria-label="Copy as JSON"
                  >
                    {copied === 'json' ? (
                      <Check size={12} className="text-emerald" />
                    ) : (
                      <FileJson size={12} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInfo((v) => !v)}
                    className="rounded-md border border-border bg-surface p-1 text-ink-muted hover:border-emerald hover:text-emerald transition-colors"
                    aria-label="Channel info"
                    title="Channel info"
                  >
                    {showInfo ? (
                      <PanelRightClose size={12} />
                    ) : (
                      <PanelRightOpen size={12} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowShortcuts(true)}
                    className="hidden sm:inline-flex rounded-md border border-border bg-surface p-1 text-ink-muted hover:border-emerald hover:text-emerald transition-colors"
                    title="Keyboard shortcuts"
                    aria-label="Keyboard shortcuts"
                  >
                    <Keyboard size={12} />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Message area + info drawer container */}
          <div className="flex-1 flex min-h-0 relative">
            <div className="flex-1 flex flex-col min-w-0 relative">
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 md:px-5 py-4 bg-canvas"
              >
                {isLoadingMessages ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="animate-spin text-emerald" size={22} />
                      <p className="text-xs text-ink-muted">Loading messages…</p>
                    </div>
                  </div>
                ) : displayMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <EmptyState
                      icon={Hash}
                      title={
                        search
                          ? 'No matches'
                          : filter !== 'all'
                            ? `No ${filter} in this channel`
                            : `Welcome to #${activeChannel.name}`
                      }
                      description={
                        search
                          ? `Nothing matches "${search}" in this channel.`
                          : filter !== 'all'
                            ? 'Try a different filter.'
                            : activeChannel.description ||
                              'No messages yet. Start the conversation.'
                      }
                    />
                  </div>
                ) : (
                  groupedMessages.map((group) => (
                    <div key={group.day}>
                      {/* Date separator */}
                      <div className="my-3 flex items-center gap-2">
                        <span className="flex-1 h-px bg-border" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted bg-canvas px-2">
                          {group.label}
                        </span>
                        <span className="flex-1 h-px bg-border" />
                      </div>

                      {/* Messages in this day */}
                      {group.messages.map((msg) => {
                        const globalIndex = displayMessages.indexOf(msg)
                        const prev = displayMessages[globalIndex - 1]
                        const showAuthor =
                          !prev ||
                          prev.authorId !== msg.authorId ||
                          new Date(String(msg.createdAt ?? '')).getTime() -
                            new Date(String(prev.createdAt ?? '')).getTime() >
                            5 * 60 * 1000

                        const isCurrentMatch =
                          currentMatch?.messageId === String(msg.id)

                        return (
                          <div
                            key={String(msg.id)}
                            id={`msg-${String(msg.id)}`}
                            className={
                              isCurrentMatch
                                ? 'rounded-lg bg-amber-50/60 -mx-1 px-1 py-0.5 transition-colors'
                                : ''
                            }
                          >
                            <MessageBubble
                              message={msg as never}
                              isMine={msg.authorId === user?.id}
                              showAuthor={showAuthor}
                            />
                          </div>
                        )
                      })}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Scroll to bottom FAB */}
              {showScrollToBottom ? (
                <button
                  type="button"
                  onClick={() => scrollToBottom()}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-emerald px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg shadow-emerald/20 hover:bg-emerald-dark transition-colors"
                >
                  <ArrowDown size={12} />
                  Jump to latest
                </button>
              ) : null}
            </div>

            {/* Info drawer */}
            {showInfo ? (
              <ChannelInfoDrawer
                channel={activeChannel}
                admins={admins}
                messageCount={rawMessages.length}
                fileCount={fileCount}
                imageCount={imageCount}
                onClose={() => setShowInfo(false)}
                onCopyChannelName={() =>
                  handleCopy(activeChannel.name, 'channel-name')
                }
                copied={copied}
              />
            ) : null}
          </div>

          <MessageComposer onSend={handleSend} />
        </div>
      </div>

      {/* Shortcuts modal */}
      {showShortcuts ? (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      ) : null}
    </AppShell>
  )
}

/* ==========================================================================
   SUBCOMPONENTS
   ========================================================================== */

function FilterPill({
  label,
  count,
  active,
  onClick,
  icon,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
        active
          ? 'border-emerald bg-emerald text-white'
          : 'border-border bg-surface text-ink-secondary hover:border-emerald/50 hover:text-emerald',
      ].join(' ')}
    >
      {icon}
      {label}
      <span
        className={[
          'text-[9px] font-bold tabular-nums',
          active ? 'text-white/80' : 'text-ink-muted',
        ].join(' ')}
      >
        {count}
      </span>
    </button>
  )
}

function ChannelInfoDrawer({
  channel,
  admins,
  messageCount,
  fileCount,
  imageCount,
  onClose,
  onCopyChannelName,
  copied,
}: {
  channel: { id: string; name: string; description?: string }
  admins: Array<{ id: string; name: string }>
  messageCount: number
  fileCount: number
  imageCount: number
  onClose: () => void
  onCopyChannelName: () => void
  copied: string | null
}) {
  return (
    <div className="w-72 border-l border-border bg-surface-alt/20 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Info size={13} className="text-ink-muted" />
          <span className="text-xs font-semibold text-ink">Channel info</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-ink-muted hover:bg-surface-alt hover:text-ink transition-colors"
          aria-label="Close info"
        >
          <X size={12} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Channel identity */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald text-white">
              <Hash size={14} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="truncate text-sm font-bold text-ink">
                  {channel.name}
                </span>
                <button
                  type="button"
                  onClick={onCopyChannelName}
                  className="rounded p-0.5 text-ink-muted hover:text-emerald transition-colors"
                  aria-label="Copy channel name"
                >
                  {copied === 'channel-name' ? (
                    <Check size={10} className="text-emerald" />
                  ) : (
                    <Copy size={10} />
                  )}
                </button>
              </div>
              <div className="text-[10px] text-ink-muted font-mono">
                {channel.id}
              </div>
            </div>
          </div>
          {channel.description ? (
            <p className="mt-2 text-[11px] text-ink-secondary leading-relaxed">
              {channel.description}
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-ink-muted italic">
              No description set
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-1">
            Activity
          </div>
          <StatRow
            icon={<MessageSquare size={11} />}
            label="Messages"
            value={messageCount}
          />
          <StatRow
            icon={<ImageIcon size={11} />}
            label="Images"
            value={imageCount}
          />
          <StatRow
            icon={<File size={11} />}
            label="Files"
            value={fileCount}
          />
        </div>

        {/* Members */}
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            <Users size={11} />
            Members ({admins.length})
          </div>
          {admins.length === 0 ? (
            <p className="text-[11px] text-ink-muted">No members yet</p>
          ) : (
            <ul className="space-y-1.5">
              {admins.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-[9px] font-bold text-white flex-shrink-0">
                    {a.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                  <span className="truncate text-[11px] font-medium text-ink">
                    {a.name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tips */}
        <div className="rounded-lg border border-emerald/20 bg-emerald-light/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-dark">
            <Sparkles size={11} />
            Tip
          </div>
          <p className="text-[11px] text-emerald-dark/80 leading-relaxed">
            Use <kbd className="rounded border border-emerald/30 bg-white px-1 font-mono text-[10px]">⌘K</kbd> or{' '}
            <kbd className="rounded border border-emerald/30 bg-white px-1 font-mono text-[10px]">/</kbd> to
            search this channel.
          </p>
        </div>
      </div>
    </div>
  )
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="flex items-center gap-1.5 text-ink-secondary">
        {icon}
        {label}
      </span>
      <span className="font-semibold text-ink tabular-nums">{value}</span>
    </div>
  )
}

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { keys: ['⌘', 'K'], label: 'Search this channel' },
    { keys: ['/'], label: 'Focus search' },
    { keys: ['?'], label: 'Toggle this help' },
    { keys: ['Esc'], label: 'Close search / modal' },
    { keys: ['↑', '↓'], label: 'Navigate matches while searching' },
  ]
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3
              id="shortcuts-title"
              className="flex items-center gap-1.5 text-sm font-bold text-ink"
            >
              <Keyboard size={14} />
              Keyboard shortcuts
            </h3>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Work when focus is not in an input.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-muted hover:bg-surface-alt"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <ul className="space-y-1">
          {shortcuts.map((s) => (
            <li
              key={s.label}
              className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-surface-alt transition-colors"
            >
              <span className="text-xs text-ink-secondary">{s.label}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-border bg-surface-alt px-1.5 py-0.5 font-mono text-[10px] text-ink-muted"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}