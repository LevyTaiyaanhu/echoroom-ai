/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { getSavedEvents, removeSavedEvent, saveEvent } from '../services/savedEvents.service'

const SavedEventsContext = createContext(null)
const EMPTY_SET = new Set()

export function SavedEventsProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const [savedIds, setSavedIds] = useState(() => new Set())
  const [savedEvents, setSavedEvents] = useState([])
  const [pendingIds, setPendingIds] = useState(() => new Set())
  const [loadError, setLoadError] = useState('')
  const [loadedRequest, setLoadedRequest] = useState('')
  const [errorRequest, setErrorRequest] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const pendingRef = useRef(new Set())
  const isFan = isAuthenticated && user?.role === 'fan'
  const requestKey = isFan ? `${user.id}:${retryCount}` : ''

  useEffect(() => {
    if (!isFan) return undefined

    const controller = new AbortController()

    getSavedEvents(controller.signal)
      .then((events) => {
        if (!controller.signal.aborted) {
          setSavedIds(new Set(events.map((event) => String(event.id))))
          setSavedEvents(events)
          setLoadError('')
          setErrorRequest('')
        }
      })
      .catch((error) => {
        if (error.name !== 'CanceledError' && !controller.signal.aborted) {
          setLoadError(error.message || 'Saved event status could not be loaded.')
          setErrorRequest(requestKey)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedRequest(requestKey)
      })

    return () => controller.abort()
  }, [isFan, requestKey])

  const toggleSaved = useCallback(async (event) => {
    const eventId = String(event.id)
    if (pendingRef.current.has(eventId)) return

    pendingRef.current.add(eventId)
    setPendingIds(new Set(pendingRef.current))
    try {
      if (savedIds.has(eventId)) {
        await removeSavedEvent(event.id)
        setSavedIds((current) => {
          const next = new Set(current)
          next.delete(eventId)
          return next
        })
        setSavedEvents((current) => current.filter((savedEvent) => String(savedEvent.id) !== eventId))
      } else {
        await saveEvent(event.id)
        setSavedIds((current) => new Set(current).add(eventId))
        setSavedEvents((current) => [...current, event])
      }
    } finally {
      pendingRef.current.delete(eventId)
      setPendingIds(new Set(pendingRef.current))
    }
  }, [savedIds])

  const value = useMemo(
    () => {
      const requestIsCurrent = isFan && loadedRequest === requestKey

      return {
        savedIds: requestIsCurrent ? savedIds : EMPTY_SET,
        savedEvents: requestIsCurrent ? savedEvents : [],
        pendingIds,
        isLoaded: !isFan || loadedRequest === requestKey,
        loadError: isFan && errorRequest === requestKey ? loadError : '',
        toggleSaved,
        retry: () => setRetryCount((current) => current + 1),
      }
    },
    [isFan, savedIds, savedEvents, pendingIds, loadedRequest, requestKey, errorRequest, loadError, toggleSaved],
  )

  return <SavedEventsContext.Provider value={value}>{children}</SavedEventsContext.Provider>
}

export function useSavedEvents() {
  const context = useContext(SavedEventsContext)

  if (!context) {
    throw new Error('useSavedEvents must be used within SavedEventsProvider')
  }

  return context
}
