import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Music2, Sparkles, UserRound } from 'lucide-react'
import ThemeToggle from '../components/common/ThemeToggle'
import NotificationBell from '../components/common/NotificationBell'
import { useAuth } from '../context/AuthContext'

const navigation = [
  { name: 'Discover', to: '/' },
]

export default function MainLayout() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const accountLinks = user?.role === 'fan'
    ? [
        { name: 'Dashboard', to: '/dashboard' },
        { name: 'Saved events', to: '/saved-events' },
        { name: 'Following', to: '/following' },
        { name: 'Notifications', to: '/notifications' },
        { name: 'Profile', to: '/settings/profile' },
      ]
    : user?.role === 'artist'
      ? [{ name: 'Artist workspace', to: '/artist' }]
      : user?.role === 'promoter'
      ? [
          { name: 'Promoter workspace', to: '/promoter' },
          { name: 'Promoter profile', to: '/promoter/profile' },
        ]
      : user?.role === 'admin'
        ? [{ name: 'Admin workspace', to: '/admin' }]
        : []

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg-elevated)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--primary)] text-white shadow-lg shadow-violet-500/20">
              <Music2 size={18} />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">EchoRoom AI</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-soft)]">Live scenes</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navigation.map(({ name, to }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `text-sm font-medium transition ${
                    isActive ? 'text-[var(--primary)]' : 'text-[var(--text-soft)] hover:text-[var(--text)]'
                  }`
                }
              >
                {name}
              </NavLink>
            ))}
            <Link to="/events" className="text-sm font-medium text-[var(--text-soft)] transition hover:text-[var(--text)]">
              Events
            </Link>
            <Link to="/artists" className="text-sm font-medium text-[var(--text-soft)] transition hover:text-[var(--text)]">
              Artists
            </Link>
            <a
              href="/#promoters"
              className="text-sm font-medium text-[var(--text-soft)] transition hover:text-[var(--text)]"
            >
              Promoters
            </a>
            {accountLinks.map(({ name, to }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `text-sm font-medium transition ${
                    isActive ? 'text-[var(--primary)]' : 'text-[var(--text-soft)] hover:text-[var(--text)]'
                  }`
                }
              >
                {name}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <ThemeToggle className="hidden sm:inline-flex" />
            {isAuthenticated ? (
              <>
                <span className="hidden max-w-32 truncate text-sm font-medium text-[var(--text)] lg:inline">
                  {user.full_name}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[var(--primary)]"
                >
                  <LogOut size={16} aria-hidden="true" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[var(--primary)]"
                >
                  <UserRound size={16} aria-hidden="true" />
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="hidden rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] sm:inline-flex"
                >
                  Join
                </Link>
              </>
            )}
          </div>
        </div>
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 pb-3 text-xs font-medium text-[var(--text-soft)] md:hidden sm:px-6"
        >
          <Link to="/" className="shrink-0 hover:text-[var(--primary)]">
            Discover
          </Link>
          <Link to="/events" className="shrink-0 hover:text-[var(--primary)]">
            Events
          </Link>
          <Link to="/artists" className="shrink-0 hover:text-[var(--primary)]">
            Artists
          </Link>
          <a href="/#promoters" className="shrink-0 hover:text-[var(--primary)]">
            Promoters
          </a>
          {accountLinks.map(({ name, to }) => (
            <Link key={to} to={to} className="shrink-0 hover:text-[var(--primary)]">
              {name}
            </Link>
          ))}
          <ThemeToggle className="ml-auto shrink-0 sm:hidden" />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--border)] bg-[var(--surface)]/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-[var(--text-soft)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--primary)]" />
            <span>EchoRoom AI</span>
          </div>
          <span>Connecting fans, promoters and venues.</span>
        </div>
      </footer>
    </div>
  )
}
