import api from './api'

function assertArray(data, key, description) {
  if (data?.success !== true || !Array.isArray(data[key])) {
    throw new Error(`The server returned an invalid ${description} response.`)
  }

  return data[key]
}

export async function getAdminUsers(signal) {
  const { data } = await api.get('/admin/users', { signal })
  return assertArray(data, 'users', 'users')
}

export async function getAdminEvents(signal) {
  const { data } = await api.get('/admin/events', { signal })
  return assertArray(data, 'events', 'events')
}

export async function getAdminReports(status, signal) {
  const params = status ? { status } : undefined
  const { data } = await api.get('/admin/reports', { params, signal })
  return assertArray(data, 'reports', 'reports')
}

export async function reviewReport(reportId, decision, notes) {
  const { data } = await api.post(
    `/admin/reports/${encodeURIComponent(reportId)}/review`,
    {
      decision,
      public_note: notes.publicNote || null,
      private_note: notes.privateNote || null,
    },
  )

  if (data?.success !== true) {
    throw new Error('The server did not confirm the report review.')
  }
}

export async function dismissReport(reportId, note) {
  const { data } = await api.post(
    `/admin/reports/${encodeURIComponent(reportId)}/dismiss`,
    { note: note || null },
  )

  if (data?.success !== true) {
    throw new Error('The server did not confirm the report dismissal.')
  }
}

export async function verifyAdminEvent(eventId, verify) {
  const action = verify ? 'verify' : 'unverify'
  const { data } = await api.post(`/admin/events/${encodeURIComponent(eventId)}/${action}`)

  if (data?.success !== true) {
    throw new Error(`The server did not confirm event ${action}.`)
  }
}

export async function getEventModerationLog(eventId, signal) {
  const { data } = await api.get(
    `/admin/events/${encodeURIComponent(eventId)}/moderation-log`,
    { signal },
  )
  return assertArray(data, 'decisions', 'moderation history')
}
