import api from './api'

export async function getFollowing(signal) {
  const { data } = await api.get('/following', { signal })
  const following = data?.following

  if (
    data?.success !== true ||
    !Array.isArray(following?.artists) ||
    !Array.isArray(following?.promoters) ||
    !following.counts ||
    typeof following.counts.artists !== 'number' ||
    typeof following.counts.promoters !== 'number'
  ) {
    throw new Error('The server returned an invalid following list.')
  }

  return following
}

export async function getFollowingEvents(signal) {
  const { data } = await api.get('/following/events', { signal })

  if (data?.success !== true || !Array.isArray(data.events)) {
    throw new Error('The server returned an invalid followed-events response.')
  }

  return data.events
}

async function updateArtistFollow(artistId, follow) {
  const method = follow ? 'post' : 'delete'
  const { data } = await api[method](`/artists/${encodeURIComponent(artistId)}/follow`)

  if (data?.success !== true) {
    throw new Error(`The server did not confirm ${follow ? 'following' : 'unfollowing'} this artist.`)
  }
}

export function followArtist(artistId) {
  return updateArtistFollow(artistId, true)
}

export function unfollowArtist(artistId) {
  return updateArtistFollow(artistId, false)
}
