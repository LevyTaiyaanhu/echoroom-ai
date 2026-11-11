import api from './api'

export async function extractFlyer(file, onUploadProgress) {
  const formData = new FormData()
  formData.append('flyer', file)

  const { data } = await api.post('/ai/extract-flyer', formData, {
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onUploadProgress) {
        onUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100))
      }
    },
  })

  if (
    data?.success !== true ||
    !data.extracted ||
    typeof data.extracted !== 'object' ||
    Array.isArray(data.extracted)
  ) {
    throw new Error('The server returned an invalid flyer extraction response.')
  }

  return {
    extracted: data.extracted,
    note: typeof data.note === 'string' ? data.note : '',
  }
}

export async function findPossibleDuplicates(details) {
  const { data } = await api.post('/ai/detect-duplicates', details)

  if (data?.success !== true || !Array.isArray(data.duplicates)) {
    throw new Error('The server returned an invalid duplicate-check response.')
  }

  return {
    duplicates: data.duplicates,
    message: typeof data.message === 'string' ? data.message : '',
  }
}

export async function generateEventDescription(details) {
  const { data } = await api.post('/ai/generate-description', details)

  if (data?.success !== true || typeof data.description !== 'string' || !data.description.trim()) {
    throw new Error('The server returned an invalid generated description.')
  }

  return {
    description: data.description,
    note: typeof data.note === 'string' ? data.note : '',
  }
}
