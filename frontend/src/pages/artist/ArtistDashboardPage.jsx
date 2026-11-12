import { useEffect, useState } from 'react'
import { Camera, Eye, EyeOff, Music2, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  createArtistProfile,
  getArtistFollowerCount,
  getMyArtistProfile,
  removeArtistPicture,
  updateArtistProfile,
  uploadArtistPicture,
} from '../../services/artists.service'
import { getApiErrorMessage } from '../../utils/apiError'

const INITIAL_PROFILE = {
  stage_name: '',
  genre: '',
  bio: '',
  city: '',
  is_private: false,
}

const ALLOWED_PICTURE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_PICTURE_SIZE = 5 * 1024 * 1024

export default function ArtistDashboardPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [values, setValues] = useState(INITIAL_PROFILE)
  const [followerCount, setFollowerCount] = useState(null)
  const [loadedRequest, setLoadedRequest] = useState('')
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  const requestKey = `${user.id}:${retry}`
  const loading = loadedRequest !== requestKey

  useEffect(() => {
    const controller = new AbortController()
    getMyArtistProfile(controller.signal)
      .then(async (artist) => {
        if (controller.signal.aborted) return
        setProfile(artist)
        setValues({
          stage_name: artist.stage_name || '',
          genre: artist.genre || '',
          bio: artist.bio || '',
          city: artist.city || '',
          is_private: artist.is_private === true,
        })
        try {
          setFollowerCount(await getArtistFollowerCount(artist.id, controller.signal))
        } catch (requestError) {
          if (requestError.name !== 'CanceledError') setFollowerCount(null)
        }
        setError('')
      })
      .catch((requestError) => {
        if (requestError.name === 'CanceledError') return
        if (requestError.response?.status === 404) {
          setProfile(null)
          setValues((current) => ({ ...current, stage_name: current.stage_name || user.full_name }))
          setError('')
        } else {
          setError(getApiErrorMessage(requestError, 'Your artist profile could not be loaded.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedRequest(requestKey)
      })

    return () => controller.abort()
  }, [requestKey, user.full_name])

  const updateField = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }))
    setError('')
    setNotice('')
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (saving || creating) return

    setSaving(true)
    setCreating(!profile)
    setError('')
    setNotice('')
    const details = {
      stage_name: values.stage_name.trim(),
      genre: values.genre.trim() || null,
      bio: values.bio.trim() || null,
      city: values.city.trim() || null,
      is_private: values.is_private,
    }

    try {
      const updated = profile
        ? await updateArtistProfile(details)
        : await createArtistProfile(details)
      setProfile(updated)
      setValues((current) => ({
        ...current,
        stage_name: updated.stage_name || '',
        genre: updated.genre || '',
        bio: updated.bio || '',
        city: updated.city || '',
        is_private: updated.is_private === true,
      }))
      setNotice(profile ? 'Artist profile saved.' : 'Artist profile created.')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Your artist profile could not be saved.'))
    } finally {
      setSaving(false)
      setCreating(false)
    }
  }

  const handlePicture = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!profile) {
      setError('Create your artist profile before adding a profile picture.')
      return
    }
    if (!ALLOWED_PICTURE_TYPES.has(file.type)) {
      setError('Choose a JPEG, PNG, WEBP, or GIF image.')
      return
    }
    if (file.size > MAX_PICTURE_SIZE) {
      setError('Choose an image no larger than 5 MB.')
      return
    }

    setUploading(true)
    setError('')
    setNotice('')
    try {
      const pictureUrl = await uploadArtistPicture(file)
      setProfile((current) => ({ ...current, profile_picture_url: pictureUrl }))
      setNotice('Profile picture updated.')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'The profile picture could not be uploaded.'))
    } finally {
      setUploading(false)
    }
  }

  const handleRemovePicture = async () => {
    if (!profile?.profile_picture_url || uploading) return
    setUploading(true)
    setError('')
    setNotice('')
    try {
      await removeArtistPicture()
      setProfile((current) => ({ ...current, profile_picture_url: null }))
      setNotice('Profile picture removed.')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'The profile picture could not be removed.'))
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return <div role="status" className="animate-pulse rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-sm text-[var(--text-soft)]">Loading your artist workspace…</div>
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Artist workspace</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-[var(--text)]">
            {profile ? `Welcome, ${profile.stage_name}` : 'Set up your artist profile'}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">Your public details are controlled by your privacy setting.</p>
        </div>
        {profile && !profile.is_private && (
          <Link to={`/artists/${encodeURIComponent(profile.id)}`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text)] hover:border-[var(--primary)]">
            <Eye size={16} aria-hidden="true" />
            Preview public profile
          </Link>
        )}
      </header>

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-600 dark:text-rose-300">
          {error}
          {!profile && error !== 'Artist profile not found' && (
            <button type="button" onClick={() => setRetry((current) => current + 1)} className="ml-3 font-semibold underline">
              Retry
            </button>
          )}
        </div>
      )}
      {notice && <p role="status" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

      {profile && (
        <section className="flex flex-wrap items-center gap-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          {profile.profile_picture_url ? (
            <img src={profile.profile_picture_url} alt={`${profile.stage_name} profile`} className="h-20 w-20 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-500/10 text-[var(--primary)]">
              <Music2 size={26} aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[var(--text)]">Profile picture</p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">JPEG, PNG, WEBP, or GIF; up to 5 MB.</p>
          </div>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text)] hover:border-[var(--primary)]">
            <Camera size={16} aria-hidden="true" />
            {uploading ? 'Uploading…' : 'Upload image'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={uploading} onChange={handlePicture} />
          </label>
          {profile.profile_picture_url && (
            <button type="button" onClick={handleRemovePicture} disabled={uploading} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-rose-500/30 px-4 text-sm font-semibold text-rose-600 hover:bg-rose-500/5 disabled:opacity-50 dark:text-rose-300">
              <Trash2 size={15} aria-hidden="true" />
              Remove
            </button>
          )}
        </section>
      )}

      <form onSubmit={handleSave} className="space-y-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-[var(--text)]">
            Artist / stage name *
            <input required minLength={2} maxLength={100} value={values.stage_name} onChange={(event) => updateField('stage_name', event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 font-normal outline-none focus:border-[var(--primary)]" />
          </label>
          <label className="space-y-2 text-sm font-semibold text-[var(--text)]">
            Music genre
            <input maxLength={100} value={values.genre} onChange={(event) => updateField('genre', event.target.value)} placeholder="e.g. Amapiano, Afro-jazz" className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 font-normal outline-none focus:border-[var(--primary)]" />
          </label>
          <label className="space-y-2 text-sm font-semibold text-[var(--text)] sm:col-span-2">
            Public biography
            <textarea maxLength={2000} value={values.bio} onChange={(event) => updateField('bio', event.target.value)} rows={5} className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 font-normal outline-none focus:border-[var(--primary)]" />
          </label>
          <label className="space-y-2 text-sm font-semibold text-[var(--text)]">
            City
            <input maxLength={100} value={values.city} onChange={(event) => updateField('city', event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 font-normal outline-none focus:border-[var(--primary)]" />
          </label>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
          <input type="checkbox" checked={values.is_private} onChange={(event) => updateField('is_private', event.target.checked)} className="mt-1 h-4 w-4 accent-[var(--primary)]" />
          <span>
            <span className="flex items-center gap-2 font-semibold text-[var(--text)]">
              {values.is_private ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              Private artist profile
            </span>
            <span className="mt-1 block text-sm leading-5 text-[var(--text-soft)]">
              Private profiles are excluded from public artist search and profile pages. Your gender and private account details are not requested or published.
            </span>
          </span>
        </label>

        <button type="submit" disabled={saving} className="min-h-11 rounded-full bg-[var(--primary)] px-6 text-sm font-semibold text-white hover:bg-[var(--primary-strong)] disabled:cursor-wait disabled:opacity-60">
          {saving ? 'Saving…' : profile ? 'Save profile' : 'Create artist profile'}
        </button>
      </form>

      {profile && (
        <>
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="text-sm text-[var(--text-soft)]">Followers</p>
            <p className="mt-2 text-3xl font-black text-[var(--text)]">{followerCount === null ? 'Unavailable' : followerCount.toLocaleString()}</p>
          </section>
          <section className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-5">
            <h2 className="font-bold text-[var(--text)]">Artist event management is not available yet</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
              The current event create, edit, and AI flyer endpoints authorize promoters only. The backend has no artist-owned event management endpoints, so this workspace does not offer actions that would be rejected or cross role boundaries.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
