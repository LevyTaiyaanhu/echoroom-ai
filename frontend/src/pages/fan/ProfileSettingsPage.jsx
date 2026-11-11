import { Bell, Palette, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import ThemeToggle from '../../components/common/ThemeToggle'

const settings = [
  { label: 'Email notifications', value: 'Not configured' },
  { label: 'Privacy controls', value: 'Coming soon' },
  { label: 'Profile editing', value: 'Coming soon' },
]

export default function ProfileSettingsPage() {
  const { user } = useAuth()

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Profile</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[var(--text)]">Appearance settings</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-strong)] text-[var(--primary)]">
              <UserRound size={24} />
            </div>
            <div>
              <p className="text-lg font-semibold text-[var(--text)]">{user.full_name}</p>
              <p className="text-sm text-[var(--text-soft)]">{user.email}</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
              <div className="flex items-center gap-3">
                <Palette size={18} className="text-[var(--primary)]" />
                <span className="font-medium text-[var(--text)]">Theme</span>
              </div>
              <ThemeToggle />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
              <div className="flex items-center gap-3">
                <Bell size={18} className="text-[var(--primary)]" />
                <span className="font-medium text-[var(--text)]">Notification preferences</span>
              </div>
              <span className="text-sm text-[var(--text-soft)]">Not configured</span>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-[var(--primary)]" />
                <span className="font-medium text-[var(--text)]">Account security</span>
              </div>
              <span className="text-sm text-[var(--text-soft)]">Managed by sign-in</span>
            </div>
          </div>
        </div>

        <aside className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">Preferences</h2>
          <div className="mt-4 space-y-3">
            {settings.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-3">
                <span className="text-sm text-[var(--text-soft)]">{label}</span>
                <span className="text-sm font-medium text-[var(--text)]">{value}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
