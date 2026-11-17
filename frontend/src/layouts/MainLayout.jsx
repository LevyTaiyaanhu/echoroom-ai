import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Building2,
  CalendarDays,
  Compass,
  House,
  LogOut,
  Music2,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react'
import ThemeToggle from '../components/common/ThemeToggle'
import NotificationBell from '../components/common/NotificationBell'
import { useAuth } from '../context/AuthContext'

const publicNavigation = [
  { name: 'Discover', to: '/', icon: Compass, end: true },
  { name: 'Events', to: '/events', icon: CalendarDays },
  { name: 'Artists', to: '/artists', icon: UsersRound },
  { name: 'Promoters', to: '/#promoters', icon: Building2, hash: '#promoters' },
]

export default function MainLayout() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const menuButtonRef = useRef(null)
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

  useEffect(() => {
    if (!mobileMenuOpen) return undefined

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setMobileMenuOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileMenuOpen])

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  const activeLinkClass = ({ isActive }) =>
    `text-sm font-medium transition ${
      isActive ? 'text-[var(--primary)]' : 'text-[var(--text-soft)] hover:text-[var(--text)]'
    }`

  const mobileLinkClass = (isActive) =>
    `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
      isActive
        ? 'bg-violet-500/10 text-[var(--primary)]'
        : 'text-[var(--text)] hover:bg-[var(--surface-strong)]'
    }`

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="fixed left-0 right-0 top-0 z-[1000] h-[var(--header-height)] w-full border-b border-[var(--border)] bg-[var(--bg)] shadow-sm">
        <div className="relative mx-auto flex h-full max-w-7xl items-center justify-between gap-1 px-2 min-[360px]:gap-3 min-[360px]:px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-1 min-[360px]:gap-2 sm:gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white shadow-lg shadow-violet-500/20 min-[360px]:h-10 min-[360px]:w-10 min-[360px]:rounded-2xl">
              <Music2 size={18} />
            </div>
            <div>
              <p className="whitespace-nowrap text-sm font-semibold tracking-tight min-[360px]:text-base sm:text-lg">EchoRoom AI</p>
              <p className="hidden text-[10px] uppercase tracking-[0.2em] text-[var(--text-soft)] sm:block">Live scenes</p>
            </div>
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-3 xl:flex">
            {publicNavigation.map(({ name, to, end, hash }) => (
              hash ? (
                <a
                  key={to}
                  href={to}
                  aria-current={location.hash === hash ? 'location' : undefined}
                  className={`${location.hash === hash ? 'text-[var(--primary)]' : 'text-[var(--text-soft)] hover:text-[var(--text)]'} text-sm font-medium transition`}
                >
                  {name}
                </a>
              ) : to === '/' ? (
                <Link
                  key={to}
                  to={to}
                  aria-current={location.pathname === '/' && location.hash !== '#promoters' ? 'page' : undefined}
                  className={`${location.pathname === '/' && location.hash !== '#promoters' ? 'text-[var(--primary)]' : 'text-[var(--text-soft)] hover:text-[var(--text)]'} text-sm font-medium transition`}
                >
                  {name}
                </Link>
              ) : (
                <NavLink key={to} to={to} end={end} className={activeLinkClass}>
                  {name}
                </NavLink>
              )
            ))}
            {accountLinks.map(({ name, to }) => (
              <NavLink key={to} to={to} className={activeLinkClass}>
                {name}
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1 min-[360px]:gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <NotificationBell />
            </div>
            <ThemeToggle className="hidden xl:inline-flex" />
            <div className="relative" ref={menuRef}>
              <button
                ref={menuButtonRef}
                type="button"
                aria-label="Home menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-navigation"
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] min-[360px]:gap-2 min-[360px]:px-3 min-[360px]:text-sm xl:hidden"
              >
                <House size={16} aria-hidden="true" />
                <span>Home</span>
              </button>
              {mobileMenuOpen && (
                <div
                  id="mobile-navigation"
                  className="fixed right-4 top-[4.5rem] z-30 max-h-[min(70vh,32rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow)] xl:hidden"
                >
                  <nav aria-label="Mobile navigation" className="space-y-1">
                    {publicNavigation.map(({ name, to, icon: Icon, end, hash }) => {
                      const isHashActive = Boolean(hash && location.hash === hash)
                      const isHomeActive = to === '/' && location.pathname === '/' && location.hash !== '#promoters'

                      return hash ? (
                        <a
                          key={to}
                          href={to}
                          aria-current={isHashActive ? 'location' : undefined}
                          onClick={() => setMobileMenuOpen(false)}
                          className={mobileLinkClass(isHashActive)}
                        >
                          <Icon size={17} aria-hidden="true" />
                          {name}
                        </a>
                      ) : to === '/' ? (
                        <Link
                          key={to}
                          to={to}
                          aria-current={isHomeActive ? 'page' : undefined}
                          onClick={() => setMobileMenuOpen(false)}
                          className={mobileLinkClass(isHomeActive)}
                        >
                          <Icon size={17} aria-hidden="true" />
                          {name}
                        </Link>
                      ) : (
                        <NavLink
                          key={to}
                          to={to}
                          end={end}
                          onClick={() => setMobileMenuOpen(false)}
                          className={({ isActive }) => mobileLinkClass(isActive)}
                        >
                          <Icon size={17} aria-hidden="true" />
                          {name}
                        </NavLink>
                      )
                    })}
                    {accountLinks.length > 0 && (
                      <>
                        <div className="my-2 border-t border-[var(--border)]" />
                        {accountLinks.map(({ name, to }) => (
                          <NavLink
                            key={to}
                            to={to}
                            onClick={() => setMobileMenuOpen(false)}
                            className={({ isActive }) => mobileLinkClass(isActive)}
                          >
                            <UserRound size={17} aria-hidden="true" />
                            {name}
                          </NavLink>
                        ))}
                      </>
                    )}
                    <div className="my-2 border-t border-[var(--border)]" />
                    <div className="px-1 py-1">
                      <ThemeToggle className="flex w-full justify-start rounded-xl border-0 bg-transparent shadow-none hover:bg-[var(--surface-strong)]" />
                    </div>
                  </nav>
                </div>
              )}
            </div>
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
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 text-xs font-medium text-[var(--text)] transition hover:border-[var(--primary)] min-[360px]:gap-2 min-[360px]:px-3 min-[360px]:text-sm"
                >
                  <UserRound size={16} aria-hidden="true" />
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="hidden min-h-10 items-center justify-center rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] xl:inline-flex"
                >
                  Join
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-[calc(var(--header-height)+2.5rem)] sm:px-6 lg:px-8">
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
