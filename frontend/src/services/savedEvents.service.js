import api from './api'

function validateEventList(data, description) {
  if (data?.success !== true || !Array.isArray(data.events)) {
    throw new Error(`The server returned an invalid ${description} response.`)
  }

  if (data.events.some((event) => !event || typeof event !== 'object' || !event.id || !event.title)) {
    throw new Error(`The server returned an invalid event in the ${description} list.`)
  }

  return data.events
}

export async function getSavedEvents(signal) {
  const { data } = await api.get('/events/saved', { signal })
  return validateEventList(data, 'saved events')
}

export async function saveEvent(eventId) {
  const { data } = await api.post(`/events/${encodeURIComponent(eventId)}/save`)

  if (data?.success !== true || typeof data.saved_count !== 'number') {
    throw new Error('The server did not confirm saving this event.')
  }

  return data.saved_count
}

export async function removeSavedEvent(eventId) {
  const { data } = await api.delete(`/events/${encodeURIComponent(eventId)}/save`)

  if (data?.success !== true || typeof data.saved_count !== 'number') {
    throw new Error('The server did not confirm removing this saved event.')
  }

  return data.saved_count
}
