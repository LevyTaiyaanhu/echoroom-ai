import api from './api'

function assertSuccessResponse(data, property, description) {
  if (data?.success !== true || !data[property]) {
    throw new Error(`The server returned an invalid ${description} response.`)
  }

  return data[property]
}

export async function getEvents(params = {}, signal) {
  const { data } = await api.get('/events', { params, signal })
  const events = assertSuccessResponse(data, 'events', 'events')

  if (!Array.isArray(events)) {
    throw new Error('The server returned an invalid events list.')
  }

  if (events.some((event) => !event || typeof event !== 'object' || !event.id || !event.title)) {
    throw new Error('The server returned an invalid event in the events list.')
  }

  return events
}

export async function getEvent(eventId, signal) {
  const { data } = await api.get(`/events/${encodeURIComponent(eventId)}`, { signal })
  const event = assertSuccessResponse(data, 'event', 'event')

  if (
    typeof event !== 'object' ||
    event === null ||
    !event.id ||
    typeof event.title !== 'string' ||
    !event.start_at
  ) {
    throw new Error('The server returned an invalid event.')
  }

  return event
}

export async function getEventEngagement(eventId, signal) {
  const { data } = await api.get(`/events/${encodeURIComponent(eventId)}/engagement`, { signal })
  const engagement = assertSuccessResponse(data, 'engagement', 'event engagement')

  if (
    typeof engagement !== 'object' ||
    engagement === null ||
    !['like_count', 'view_count', 'share_count'].every(
      (field) => typeof engagement[field] === 'number' && Number.isFinite(engagement[field]),
    )
  ) {
    throw new Error('The server returned invalid event engagement.')
  }

  return engagement
}

export async function getEventLikes(eventId, signal) {
  const { data } = await api.get(`/events/${encodeURIComponent(eventId)}/liked`, { signal })
  const liked = assertSuccessResponse(data, 'liked', 'event likes')

  if (!Array.isArray(liked)) {
    throw new Error('The server returned an invalid event likes list.')
  }

  return liked
}

export async function setEventLiked(eventId, liked) {
  const method = liked ? 'post' : 'delete'
  const { data } = await api[method](`/events/${encodeURIComponent(eventId)}/like`)

  if (data?.success !== true || typeof data.like_count !== 'number' || !Number.isFinite(data.like_count)) {
    throw new Error('The server did not confirm the event like update.')
  }

  return Number(data.like_count)
}

export async function recordEventShare(eventId, platform) {
  const { data } = await api.post(`/events/${encodeURIComponent(eventId)}/share`, { platform })

  if (data?.success !== true || typeof data.share_count !== 'number' || !Number.isFinite(data.share_count)) {
    throw new Error('The server did not confirm the event share.')
  }

  return data.share_count
}

function validateManagedEvent(data, description) {
  const event = assertSuccessResponse(data, 'event', description)

  if (!event || typeof event !== 'object' || !event.id || typeof event.title !== 'string') {
    throw new Error(`The server returned an invalid ${description}.`)
  }

  return event
}

export async function createEvent(eventDetails) {
  const { data } = await api.post('/events', eventDetails)
  return validateManagedEvent(data, 'created event')
}

export async function updateEvent(eventId, eventDetails) {
  const { data } = await api.put(`/events/${encodeURIComponent(eventId)}`, eventDetails)
  return validateManagedEvent(data, 'updated event')
}

export async function cancelEvent(eventId) {
  const { data } = await api.patch(`/events/${encodeURIComponent(eventId)}/cancel`)
  const event = assertSuccessResponse(data, 'event', 'cancelled event')

  if (!event.id || event.status !== 'cancelled') {
    throw new Error('The server did not confirm event cancellation.')
  }

  return event
}
