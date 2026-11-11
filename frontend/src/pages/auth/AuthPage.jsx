import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Lock, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getApiErrorMessage } from '../../utils/apiError'

function getRoleHome(role) {
  if (role === 'promoter') return '/promoter'
  if (role === 'admin') return '/admin'
  return '/dashboard'
}

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const location = useLocation()
  const { login, register, sessionError } = useAuth()
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'fan',
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')
    setSubmitting(true)

    try {
      const user = isRegister
        ? await register({
            full_name: form.full_name.trim(),
            email: form.email.trim(),
            password: form.password,
            role: form.role,
          })
        : await login({
            email: form.email.trim(),
            password: form.password,
          })

      const destination = location.state?.from?.pathname || getRoleHome(user.role)
      navigate(destination, { replace: true })
    } catch (error) {
      setFormError(
        getApiErrorMessage(
          error,
          isRegister ? 'Could not create your account. Please try again.' : 'Could not sign in. Please try again.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const notice = formError || location.state?.sessionError || sessionError

  return (
    <div className="mx-auto max-w-5xl rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[24px] bg-[linear-gradient(135deg,_rgba(124,58,237,0.16),_rgba(15,23,42,0.02))] p-6">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
            <ShieldCheck size={12} aria-hidden="true" />
            EchoRoom account
          </div>

          <h1 className="text-4xl font-black tracking-[-0.06em] text-[var(--text)]">
            {isRegister ? 'Join the room.' : 'Welcome back.'}
          </h1>
          <p className="mt-3 text-base leading-7 text-[var(--text-soft)]">
            {isRegister
              ? 'Create your account to discover events or share the nights you organize.'
              : 'Sign in to continue to your EchoRoom workspace.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {notice && (
            <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-[var(--text)]">
              {notice}
            </p>
          )}

          {isRegister && (
            <>
              <div>
                <label htmlFor="full_name" className="mb-2 block text-sm font-medium text-[var(--text)]">
                  Full name
                </label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-4 top-3.5 text-[var(--text-soft)]" size={18} aria-hidden="true" />
                  <input
                    id="full_name"
                    name="full_name"
                    value={form.full_name}
                    onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                    minLength={2}
                    maxLength={100}
                    required
                    autoComplete="name"
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] py-3 pl-11 pr-4 text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
                    placeholder="Your name"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="role" className="mb-2 block text-sm font-medium text-[var(--text)]">
                  I’m joining as
                </label>
                <select
                  id="role"
                  value={form.role}
                  onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
                >
                  <option value="fan">Fan</option>
                  <option value="promoter">Promoter</option>
                </select>
                <p className="mt-2 text-xs text-[var(--text-soft)]">
                  Administrator access is assigned privately and can’t be selected during public registration.
                </p>
              </div>
            </>
          )}

          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-[var(--text)]">
              Email address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-3.5 text-[var(--text-soft)]" size={18} aria-hidden="true" />
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
                autoComplete="email"
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] py-3 pl-11 pr-4 text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-[var(--text)]">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-3.5 text-[var(--text-soft)]" size={18} aria-hidden="true" />
              <input
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                minLength={8}
                required
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] py-3 pl-11 pr-4 text-[var(--text)] outline-none transition focus:border-[var(--primary)]"
                placeholder="At least 8 characters"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:cursor-wait disabled:opacity-70"
          >
            {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </button>

          <p className="text-center text-sm text-[var(--text-soft)]">
            {isRegister ? 'Already have an account?' : 'New to EchoRoom?'}{' '}
            <Link
              to={isRegister ? '/login' : '/register'}
              className="font-semibold text-[var(--primary)] hover:text-[var(--primary-strong)]"
            >
              {isRegister ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
