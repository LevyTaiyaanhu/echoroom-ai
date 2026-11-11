import { useEffect, useState } from 'react'
import { ArrowLeft, Building2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getMyPromoterProfile, updateMyPromoterProfile } from '../../services/promoter.service'
import { getApiErrorMessage } from '../../utils/apiError'

export default function PromoterProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState({
    display_name: user.full_name,
    bio: '',
    city: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    getMyPromoterProfile(user.id, controller.signal)
      .then((profile) => {
        if (profile) {
          setValues({
            display_name: profile.display_name || user.full_name,
            bio: profile.bio || '',
            city: profile.city || '',
          })
        }
      })
      .catch((error) => {
        if (error.name !== 'CanceledError') {
          setLoadError(getApiErrorMessage(error, 'Could not load your promoter profile.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [user.id, user.full_name])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setSaveError('')

    try {
      await updateMyPromoterProfile({
        display_name: values.display_name.trim(),
        bio: values.bio.trim() || null,
        city: values.city.trim() || null,
      })
      navigate('/promoter', { replace: true })
    } catch (error) {
      setSaveError(getApiErrorMessage(error, 'Could not save your profile. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)]'
  const labelClass = 'flex flex-col gap-2 text-sm font-medium text-[var(--text)]'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to="/promoter"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-soft)] transition hover:text-[var(--primary)]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to promoter workspace
      </Link>

      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-[var(--primary)]">
            <Building2 size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">Promoter profile</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[var(--text)]">Tell fans who you are</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
              This public profile helps fans recognize your event listings.
            </p>
          </div>
        </div>

        {loading && (
          <p role="status" className="mt-7 text-sm text-[var(--text-soft)]">Loading your profile…</p>
        )}

        {!loading && (
          <>
            {loadError && (
              <p role="alert" className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-[var(--text-soft)]">
                Existing profile details could not be loaded: {loadError} You can still submit changes.
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              {saveError && (
                <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-[var(--text)]">
                  {saveError}
                </p>
              )}

              <label className={labelClass}>
                Display name *
                <input
                  className={inputClass}
                  value={values.display_name}
                  onChange={(event) => setValues((current) => ({ ...current, display_name: event.target.value }))}
                  minLength={2}
                  maxLength={100}
                  required
                />
              </label>

              <label className={labelClass}>
                City
                <input
                  className={inputClass}
                  value={values.city}
                  onChange={(event) => setValues((current) => ({ ...current, city: event.target.value }))}
                  maxLength={100}
                  placeholder="Where you organize events"
                />
              </label>

              <label className={labelClass}>
                About your team
                <textarea
                  className={`${inputClass} min-h-36 resize-y`}
                  value={values.bio}
                  onChange={(event) => setValues((current) => ({ ...current, bio: event.target.value }))}
                  maxLength={2000}
                  placeholder="Tell fans what your team brings to the local scene."
                />
                <span className="text-right text-xs font-normal text-[var(--text-soft)]">
                  {values.bio.length}/2000
                </span>
              </label>

              <div className="flex flex-col-reverse gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:justify-end">
                <Link
                  to="/promoter"
                  className="rounded-xl border border-[var(--border)] px-5 py-3 text-center text-sm font-semibold text-[var(--text)] transition hover:border-[var(--primary)]"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:cursor-wait disabled:opacity-70"
                >
                  {saving ? 'Saving…' : 'Save promoter profile'}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
