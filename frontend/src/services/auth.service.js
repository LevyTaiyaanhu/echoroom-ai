import api from './api'

const VALID_ROLES = new Set(['fan', 'promoter', 'admin'])

function validateUser(user) {
  if (
    !user ||
    (typeof user.id !== 'string' && typeof user.id !== 'number') ||
    typeof user.full_name !== 'string' ||
    typeof user.email !== 'string' ||
    !VALID_ROLES.has(user.role)
  ) {
    throw new Error('The server returned an invalid user profile.')
  }

  return user
}

function validateSession(data) {
  if (data?.success !== true || typeof data.token !== 'string' || !data.token.trim()) {
    throw new Error('The server returned an invalid authentication response.')
  }

  return {
    user: validateUser(data.user),
    token: data.token,
  }
}

export async function loginUser(credentials) {
  const { data } = await api.post('/auth/login', credentials)
  return validateSession(data)
}

export async function registerUser(details) {
  const { data } = await api.post('/auth/register', details)
  return validateSession(data)
}

export async function getCurrentUser(signal) {
  const { data } = await api.get('/auth/me', { signal })

  if (data?.success !== true) {
    throw new Error('The server could not verify the current session.')
  }

  return validateUser(data.user)
}
