import api from './api'

function validateArtist(data, property = 'artist') {
  const artist = data?.[property]

  if (
    data?.success !== true ||
    !artist ||
    (typeof artist.id !== 'string' && typeof artist.id !== 'number') ||
    typeof artist.stage_name !== 'string'
  ) {
    throw new Error('The server returned an invalid artist profile.')
  }

  return artist
}

export async function getArtists(params = {}, signal) {
  const { data } = await api.get('/artists', { params, signal })

  if (data?.success !== true || !Array.isArray(data.artists)) {
    throw new Error('The server returned an invalid artist list.')
  }

  return data.artists
}

export async function getArtist(artistId, signal) {
  const { data } = await api.get(`/artists/${encodeURIComponent(artistId)}`, { signal })
  return validateArtist(data)
}

export async function getMyArtistProfile(signal) {
  const { data } = await api.get('/artists/me', { signal })
  return validateArtist(data)
}

export async function createArtistProfile(profile) {
  const { data } = await api.post('/artists/me', profile)
  return validateArtist(data)
}

export async function updateArtistProfile(profile) {
  const { data } = await api.put('/artists/me', profile)
  return validateArtist(data)
}

export async function uploadArtistPicture(file) {
  const formData = new FormData()
  formData.append('profile_picture', file)

  const { data } = await api.post('/artists/me/picture', formData)

  if (data?.success !== true || typeof data.profile_picture_url !== 'string') {
    throw new Error('The server did not confirm the profile picture upload.')
  }

  return data.profile_picture_url
}

export async function removeArtistPicture() {
  const { data } = await api.delete('/artists/me/picture')

  if (data?.success !== true) {
    throw new Error('The server did not confirm removing the profile picture.')
  }
}

export async function getArtistFollowerCount(artistId, signal) {
  const { data } = await api.get(`/artists/${encodeURIComponent(artistId)}/followers`, { signal })
  const count = data?.followers?.count

  if (data?.success !== true || typeof count !== 'number' || !Number.isFinite(count)) {
    throw new Error('The server returned an invalid artist follower count.')
  }

  return count
}
