import { useEffect, useState } from 'react'
import { Bell, Palette, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import ThemeToggle from '../../components/common/ThemeToggle'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../../services/notifications.service'
import { getApiErrorMessage } from '../../utils/apiError'

export default function ProfileSettingsPage() {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState(null)
  const [loadingPreferences, setLoadingPreferences] = useState(true)
  const [savingPreference, setSavingPreference] = useState(false)
  const [preferenceError, setPreferenceError] = useState('')
  const [preferenceMessage, setPreferenceMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    getNotificationPreferences(controller.signal)
      .then((loadedPreferences) => {
        if (!controller.signal.aborted) setPreferences(loadedPreferences)
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setPreferenceError(getApiErrorMessage(error, 'Notification preferences could not be loaded.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPreferences(false)
      })

    return () => controller.abort()
  }, [user.id])

  const handlePreferenceChange = async (field) => {
    if (!preferences || savingPreference) return

    setSavingPreference(true)
    setPreferenceError('')
    setPreferenceMessage('')
    try {
      const updatedPreferences = await updateNotificationPreferences({
        ...preferences,
        [field]: !preferences[field],
      })
      setPreferences(updatedPreferences)
      setPreferenceMessage('Notification preferences saved.')
    } catch (error) {
      setPreferenceError(getApiErrorMessage(error, 'Notification preferences could not be saved.'))
    } finally {
      setSavingPreference(false)
    }
  }

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
              <span className="text-sm text-[var(--text-soft)]">
                {loadingPreferences ? 'Loading…' : preferences ? 'Manage below' : 'Unavailable'}
              </span>
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
          <div className="mt-4 space-y-3" aria-busy={loadingPreferences || savingPreference}>
            {[
              ['event_reminders', 'Event reminders'],
              ['new_events_from_followed', 'New events from followed accounts'],
              ['saved_event_changes', 'Changes to saved events'],
            ].map(([field, label]) => (
              <div key={field} className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-3">
                <span className="text-sm text-[var(--text)]">{label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(preferences?.[field])}
                  aria-label={label}
                  disabled={!preferences || loadingPreferences || savingPreference}
                  onClick={() => handlePreferenceChange(field)}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50 ${
                    preferences?.[field] ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      preferences?.[field] ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
          {loadingPreferences && <p role="status" className="mt-4 text-sm text-[var(--text-soft)]">Loading notification preferences…</p>}
          {preferenceError && <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-300">{preferenceError}</p>}
          {preferenceMessage && <p role="status" className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">{preferenceMessage}</p>}
        </aside>
      </div>
    </div>
  )
}
