import api from './api'

const PREFERENCES_FIELDS = [
  'event_reminders',
  'new_events_from_followed',
  'saved_event_changes',
]

function validatePreferences(data) {
  const preferences = data?.preferences

  if (
    data?.success !== true ||
    !preferences ||
    !PREFERENCES_FIELDS.every((field) => typeof preferences[field] === 'boolean')
  ) {
    throw new Error('The server returned invalid notification preferences.')
  }

  return preferences
}

export async function getNotifications({ limit = 20, offset = 0 } = {}, signal) {
  const { data } = await api.get('/notifications', {
    params: { limit, offset },
    signal,
  })

  if (data?.success !== true || !Array.isArray(data.notifications)) {
    throw new Error('The server returned an invalid notifications response.')
  }

  if (
    data.notifications.some(
      (notification) =>
        !notification ||
        typeof notification.id !== 'string' ||
        typeof notification.title !== 'string' ||
        typeof notification.message !== 'string' ||
        typeof notification.is_read !== 'boolean',
    )
  ) {
    throw new Error('The server returned an invalid notification.')
  }

  return data.notifications
}

export async function getUnreadNotificationCount(signal) {
  const { data } = await api.get('/notifications/unread-count', { signal })

  if (data?.success !== true || typeof data.unread_count !== 'number') {
    throw new Error('The server returned an invalid unread notification count.')
  }

  return data.unread_count
}

export async function markNotificationRead(notificationId) {
  const { data } = await api.patch(`/notifications/${encodeURIComponent(notificationId)}/read`)

  if (data?.success !== true) {
    throw new Error('The server did not confirm marking the notification as read.')
  }
}

export async function markAllNotificationsRead() {
  const { data } = await api.patch('/notifications/read-all')

  if (data?.success !== true) {
    throw new Error('The server did not confirm marking notifications as read.')
  }
}

export async function getNotificationPreferences(signal) {
  const { data } = await api.get('/notifications/preferences', { signal })
  return validatePreferences(data)
}

export async function updateNotificationPreferences(preferences) {
  const { data } = await api.patch('/notifications/preferences', preferences)
  return validatePreferences(data)
}
