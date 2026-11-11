import api from './api'

function assertSuccess(data, property, description) {
  if (data?.success !== true || data[property] === undefined || data[property] === null) {
    throw new Error(`The server returned an invalid ${description} response.`)
  }

  return data[property]
}

export async function getMyPromoterEvents(signal) {
  const { data } = await api.get('/promoters/me/events', { signal })
  const events = assertSuccess(data, 'events', 'promoter events')

  if (!Array.isArray(events)) {
    throw new Error('The server returned an invalid promoter events list.')
  }

  return events
}

export async function getMyPromoterEngagement(signal) {
  const { data } = await api.get('/promoters/me/engagement', { signal })
  const engagement = assertSuccess(data, 'engagement', 'promoter engagement')
  const countFields = ['total_events', 'active_events', 'total_likes', 'total_views', 'total_shares']

  if (
    typeof engagement !== 'object' ||
    countFields.some((field) => typeof engagement[field] !== 'number' || !Number.isFinite(engagement[field]))
  ) {
    throw new Error('The server returned invalid promoter engagement counts.')
  }

  return engagement
}

export async function getMyPromoterProfile(userId, signal) {
  const { data } = await api.get('/promoters', { signal })
  const promoters = assertSuccess(data, 'promoters', 'promoters')

  if (!Array.isArray(promoters)) {
    throw new Error('The server returned an invalid promoters list.')
  }

  return promoters.find((profile) => String(profile.user_id) === String(userId)) || null
}

export async function updateMyPromoterProfile(profile) {
  const { data } = await api.put('/promoters/me', profile)
  const updatedProfile = assertSuccess(data, 'promoter', 'promoter profile')

  if (
    (typeof updatedProfile.user_id !== 'string' && typeof updatedProfile.user_id !== 'number') ||
    typeof updatedProfile.display_name !== 'string'
  ) {
    throw new Error('The server returned an invalid promoter profile.')
  }

  return updatedProfile
}

export async function getMyPromoterFollowers(signal) {
  const { data } = await api.get('/promoters/me/followers', { signal })
  const followers = assertSuccess(data, 'followers', 'promoter followers')

  if (typeof followers.count !== 'number' || !Number.isFinite(followers.count)) {
    throw new Error('The server returned an invalid follower count.')
  }

  return followers.count
}
