import { useEffect, useState } from 'react'
import { Bell, CheckCheck, RefreshCw } from 'lucide-react'
import { formatDistanceToNow, isValid } from 'date-fns'
import { Link, useNavigate } from 'react-router-dom'
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notifications.service'
import { getApiErrorMessage } from '../../utils/apiError'

const PAGE_SIZE = 20

function formatCreatedAt(value) {
  const date = new Date(value)
  return isValid(date) ? formatDistanceToNow(date, { addSuffix: true }) : 'Time unavailable'
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadedRetry, setLoadedRetry] = useState(-1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [pendingId, setPendingId] = useState('')
  const [retry, setRetry] = useState(0)
  const loading = loadedRetry !== retry

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      getNotifications({ limit: PAGE_SIZE, offset: 0 }, controller.signal),
      getUnreadNotificationCount(controller.signal),
    ])
      .then(([items, count]) => {
        setNotifications(items)
        setUnreadCount(count)
        setOffset(items.length)
        setHasMore(items.length === PAGE_SIZE)
        setError('')
      })
      .catch((requestError) => {
        if (requestError.name !== 'CanceledError') {
          setError(getApiErrorMessage(requestError, 'Notifications could not be loaded.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedRetry(retry)
      })

    return () => controller.abort()
  }, [retry])

  const loadMore = async () => {
    setLoadingMore(true)
    setActionError('')
    try {
      const items = await getNotifications({ limit: PAGE_SIZE, offset })
      setNotifications((current) => [...current, ...items])
      setOffset((current) => current + items.length)
      setHasMore(items.length === PAGE_SIZE)
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'More notifications could not be loaded.'))
    } finally {
      setLoadingMore(false)
    }
  }

  const handleOpen = async (notification) => {
    if (notification.is_read) {
      if (notification.event_id) navigate(`/events/${encodeURIComponent(notification.event_id)}`)
      return
    }

    setPendingId(notification.id)
    setActionError('')
    try {
      await markNotificationRead(notification.id)
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, is_read: true, read_at: new Date().toISOString() } : item
      )))
      setUnreadCount((current) => Math.max(0, (current ?? 1) - 1))
      window.dispatchEvent(new Event('echoroom:notifications-updated'))
      if (notification.event_id) navigate(`/events/${encodeURIComponent(notification.event_id)}`)
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'Could not mark this notification as read.'))
    } finally {
      setPendingId('')
    }
  }

  const handleMarkAllRead = async () => {
    setPendingId('all')
    setActionError('')
    try {
      await markAllNotificationsRead()
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true, read_at: item.read_at || new Date().toISOString() })))
      setUnreadCount(0)
      window.dispatchEvent(new Event('echoroom:notifications-updated'))
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'Could not mark notifications as read.'))
    } finally {
      setPendingId('')
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Your updates</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-[var(--text)]">Notifications</h1>
          {unreadCount !== null && <p className="mt-2 text-sm text-[var(--text-soft)]">{unreadCount} unread</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/settings/profile" className="inline-flex min-h-10 items-center rounded-full border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text)] hover:border-[var(--primary)]">
            Notification preferences
          </Link>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={!unreadCount || Boolean(pendingId)}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--primary-strong)] disabled:opacity-50"
          >
            <CheckCheck size={16} aria-hidden="true" />
            {pendingId === 'all' ? 'Updating…' : 'Mark all read'}
          </button>
        </div>
      </header>

      {loading && (
        <div role="status" className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} aria-hidden="true" className="animate-pulse rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="h-4 w-1/3 rounded bg-[var(--surface-strong)]" />
              <div className="mt-3 h-4 w-4/5 rounded bg-[var(--surface-strong)]" />
              <div className="mt-3 h-3 w-1/4 rounded bg-[var(--surface-strong)]" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div role="alert" className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-6">
          <p className="text-sm text-[var(--text-soft)]">{error}</p>
          <button type="button" onClick={() => setRetry((current) => current + 1)} className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)]">
            <RefreshCw size={15} aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {actionError && <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-600 dark:text-rose-300">{actionError}</p>}

      {!loading && !error && notifications.length === 0 && (
        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
          <Bell size={25} className="mx-auto text-[var(--primary)]" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-bold text-[var(--text)]">You’re all caught up</h2>
          <p className="mt-2 text-sm text-[var(--text-soft)]">Notifications will appear here when the service provides them.</p>
        </div>
      )}

      {!loading && !error && notifications.length > 0 && (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className={`rounded-3xl border p-5 transition ${
                notification.is_read
                  ? 'border-[var(--border)] bg-[var(--surface)]'
                  : 'border-violet-500/30 bg-violet-500/5'
              }`}
            >
              <div className="flex items-start gap-4">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.is_read ? 'bg-transparent' : 'bg-[var(--primary)]'}`} aria-label={notification.is_read ? 'Read' : 'Unread'} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="font-bold text-[var(--text)]">{notification.title}</h2>
                    <time className="text-xs text-[var(--text-soft)]" dateTime={notification.created_at}>
                      {formatCreatedAt(notification.created_at)}
                    </time>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{notification.message}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {!notification.is_read && (
                      <button
                        type="button"
                        onClick={() => handleOpen(notification)}
                        disabled={Boolean(pendingId)}
                        className="text-sm font-semibold text-[var(--primary)] hover:underline disabled:opacity-60"
                      >
                        {pendingId === notification.id ? 'Updating…' : notification.event_id ? 'Mark read and view event' : 'Mark as read'}
                      </button>
                    )}
                    {notification.is_read && notification.event_id && (
                      <Link to={`/events/${encodeURIComponent(notification.event_id)}`} className="text-sm font-semibold text-[var(--primary)] hover:underline">
                        View event
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && !error && hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mx-auto flex min-h-11 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--text)] hover:border-[var(--primary)] disabled:opacity-60"
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
