export function getApiErrorMessage(error, fallback) {
  const responseMessage = error?.response?.data?.message

  if (typeof responseMessage === 'string' && responseMessage.trim()) {
    return responseMessage
  }

  if (error?.code === 'ERR_NETWORK') {
    return 'Could not reach the service. Check that the backend is running, then try again.'
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message
  }

  return fallback
}
