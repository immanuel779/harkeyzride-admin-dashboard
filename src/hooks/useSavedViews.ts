import { useCallback, useEffect, useState } from 'react'

export type SavedView = {
  id: string
  name: string
  query: string
  filters: Record<string, string>
  sortKey: string | null
  sortDir: 'asc' | 'desc'
  createdAt: string
}

const PREFIX = 'harkeyzride.savedviews.'

function storageKey(viewKey: string) {
  return `${PREFIX}${viewKey}`
}

function loadFromStorage(viewKey: string): SavedView[] {
  try {
    const raw = localStorage.getItem(storageKey(viewKey))
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedView[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveToStorage(viewKey: string, views: SavedView[]) {
  try {
    localStorage.setItem(storageKey(viewKey), JSON.stringify(views))
  } catch {
    // ignore
  }
}

export function useSavedViews(viewKey: string | undefined) {
  const [views, setViews] = useState<SavedView[]>([])

  useEffect(() => {
    if (!viewKey) {
      setViews([])
      return
    }
    setViews(loadFromStorage(viewKey))
  }, [viewKey])

  const add = useCallback(
    (view: Omit<SavedView, 'id' | 'createdAt'>) => {
      if (!viewKey) return
      const next: SavedView = {
        ...view,
        id: `v_${Date.now()}`,
        createdAt: new Date().toISOString(),
      }
      setViews((prev) => {
        const updated = [...prev, next]
        saveToStorage(viewKey, updated)
        return updated
      })
      return next
    },
    [viewKey],
  )

  const remove = useCallback(
    (id: string) => {
      if (!viewKey) return
      setViews((prev) => {
        const updated = prev.filter((v) => v.id !== id)
        saveToStorage(viewKey, updated)
        return updated
      })
    },
    [viewKey],
  )

  return { views, add, remove }
}