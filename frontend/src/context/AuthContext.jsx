/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getApiErrorMessage } from '../utils/apiError'
import { getCurrentUser, loginUser, registerUser } from '../services/auth.service'

const AuthContext = createContext(null)
const TOKEN_STORAGE_KEY = 'echoroom-token'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY))
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)))
  const [sessionError, setSessionError] = useState('')

  useEffect(() => {
    localStorage.removeItem('echoroom-user')

    if (!token) return undefined

    const controller = new AbortController()

    getCurrentUser(controller.signal)
      .then((currentUser) => {
        setUser(currentUser)
        setSessionError('')
      })
      .catch((error) => {
        if (error.name === 'CanceledError') return

        if (error.response?.status === 401) {
          localStorage.removeItem(TOKEN_STORAGE_KEY)
          setToken(null)
          setUser(null)
          setSessionError('Your session expired. Please sign in again.')
        } else {
          setUser(null)
          setSessionError(getApiErrorMessage(error, 'Could not verify your session. Please sign in again.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [token])

  const login = useCallback(async (credentials) => {
    const session = await loginUser(credentials)
    localStorage.setItem(TOKEN_STORAGE_KEY, session.token)
    setToken(session.token)
    setUser(session.user)
    setSessionError('')
    setIsLoading(false)
    return session.user
  }, [])

  const register = useCallback(async (details) => {
    const session = await registerUser(details)
    localStorage.setItem(TOKEN_STORAGE_KEY, session.token)
    setToken(session.token)
    setUser(session.user)
    setSessionError('')
    setIsLoading(false)
    return session.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem('echoroom-user')
    setToken(null)
    setUser(null)
    setSessionError('')
    setIsLoading(false)
  }, [])

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      sessionError,
      isAuthenticated: Boolean(user && token),
      login,
      register,
      logout,
    }),
    [user, token, isLoading, sessionError, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
