import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getUnreadNotificationCount } from '../../services/notifications.service'

export default function NotificationBell() {
  const { isAuthenticated, user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadError, setUnreadError] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'fan') return undefined

    const controller = new AbortController()
    const refresh = () => {
      getUnreadNotificationCount(controller.signal)
        .then((count) => {
          setUnreadCount(count)
          setUnreadError(false)
        })
        .catch((error) => {
          if (error.name !== 'CanceledError') setUnreadError(true)
        })
    }

    refresh()
    window.addEventListener('echoroom:notifications-updated', refresh)

    return () => {
      controller.abort()
      window.removeEventListener('echoroom:notifications-updated', refresh)
    }
  }, [isAuthenticated, user?.id, user?.role])

  if (!isAuthenticated || user?.role !== 'fan') return null

  return (
    <Link
      to="/notifications"
      aria-label={
        unreadError
          ? 'Notifications, unread count unavailable'
          : unreadCount
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
      }
      title={unreadError ? 'Unread notification count unavailable' : undefined}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] transition hover:border-[var(--primary)]"
    >
      <Bell size={17} aria-hidden="true" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
