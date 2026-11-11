import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, isLoading, sessionError, user } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div role="status" className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-soft)]">
        Verifying your account…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location, sessionError }} />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div role="alert" className="mx-auto max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <h1 className="text-xl font-bold text-[var(--text)]">This workspace isn’t available for your role.</h1>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          You’re signed in as {user.role}. Choose the workspace for your account or return to discovery.
        </p>
        <Link to="/" className="mt-5 inline-flex rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">
          Back to discovery
        </Link>
      </div>
    )
  }

  return children
}
