import api from './api'

export async function getPromoters(signal) {
  const { data } = await api.get('/promoters', { signal })

  if (data?.success !== true || !Array.isArray(data.promoters)) {
    throw new Error('The server returned an invalid promoters response.')
  }

  return data.promoters
}

export async function followPromoter(promoterId) {
  const { data } = await api.post(`/promoters/${encodeURIComponent(promoterId)}/follow`)

  if (data?.success !== true) {
    throw new Error('The server did not confirm following this promoter.')
  }
}

export async function unfollowPromoter(promoterId) {
  const { data } = await api.delete(`/promoters/${encodeURIComponent(promoterId)}/follow`)

  if (data?.success !== true) {
    throw new Error('The server did not confirm unfollowing this promoter.')
  }
}
