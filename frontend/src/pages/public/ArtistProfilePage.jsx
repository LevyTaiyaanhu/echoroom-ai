import { useEffect, useState } from 'react'
import { ArrowLeft, MapPin, Music2, UserRound } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getArtist, getArtistFollowerCount } from '../../services/artists.service'
import { followArtist, getFollowing, unfollowArtist } from '../../services/following.service'
import { getApiErrorMessage } from '../../utils/apiError'

export default function ArtistProfilePage() {
  const { artistId } = useParams()
  const { isAuthenticated, user } = useAuth()
  const [artist, setArtist] = useState(null)
  const [followerCount, setFollowerCount] = useState(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followingLoaded, setFollowingLoaded] = useState(false)
  const [loadedRequest, setLoadedRequest] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const canFollow = isAuthenticated && user?.role === 'fan'
  const requestKey = `${artistId}:${canFollow}`
  const loading = loadedRequest !== requestKey

  useEffect(() => {
    const controller = new AbortController()
    const requests = [
      getArtist(artistId, controller.signal),
      getArtistFollowerCount(artistId, controller.signal),
    ]
    if (canFollow) requests.push(getFollowing(controller.signal))

    Promise.all(requests)
      .then(([profile, count, following]) => {
        if (controller.signal.aborted) return
        setArtist(profile)
        setFollowerCount(count)
        if (following) {
          setIsFollowing(following.artists.some((entry) => String(entry.artist_id) === String(profile.id)))
          setFollowingLoaded(true)
        } else {
          setFollowingLoaded(false)
        }
        setError('')
      })
      .catch((requestError) => {
        if (requestError.name !== 'CanceledError') {
          setError(getApiErrorMessage(requestError, 'This public artist profile could not be loaded.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedRequest(requestKey)
      })

    return () => controller.abort()
  }, [artistId, canFollow, requestKey])

  const handleFollow = async () => {
    if (!artist || !canFollow || !followingLoaded || pending) return
    setPending(true)
    setActionError('')
    try {
      if (isFollowing) await unfollowArtist(artist.id)
      else await followArtist(artist.id)
      setIsFollowing((current) => !current)
      setFollowerCount((current) => current === null ? current : Math.max(0, current + (isFollowing ? -1 : 1)))
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'Could not update this follow. Please try again.'))
    } finally {
      setPending(false)
    }
  }

  if (loading) return <div role="status" className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-sm text-[var(--text-soft)]">Loading artist profile…</div>
  if (error || !artist) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-7">
        <h1 className="text-xl font-bold text-[var(--text)]">Artist profile unavailable</h1>
        <p role="alert" className="mt-2 text-sm text-[var(--text-soft)]">{error || 'This artist does not have a public profile.'}</p>
        <Link to="/artists" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)]"><ArrowLeft size={15} aria-hidden="true" /> Back to artists</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/artists" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-soft)] hover:text-[var(--primary)]"><ArrowLeft size={15} aria-hidden="true" /> All artists</Link>
      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-9">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {artist.profile_picture_url ? (
            <img src={artist.profile_picture_url} alt={`${artist.stage_name} profile`} className="h-28 w-28 rounded-3xl object-cover" />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-violet-500/10 text-[var(--primary)]"><UserRound size={36} aria-hidden="true" /></div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">Artist</p>
            <h1 className="mt-2 break-words text-4xl font-black tracking-[-0.06em] text-[var(--text)]">{artist.stage_name}</h1>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--text-soft)]">
              {artist.genre && <span className="inline-flex items-center gap-2"><Music2 size={15} aria-hidden="true" />{artist.genre}</span>}
              {artist.city && <span className="inline-flex items-center gap-2"><MapPin size={15} aria-hidden="true" />{artist.city}</span>}
              {followerCount !== null && <span>{followerCount.toLocaleString()} followers</span>}
            </div>
          </div>
          {canFollow && (
            <button type="button" onClick={handleFollow} disabled={!followingLoaded || pending} aria-pressed={isFollowing} className="min-h-11 rounded-full bg-[var(--primary)] px-6 text-sm font-semibold text-white hover:bg-[var(--primary-strong)] disabled:opacity-50">
              {pending ? 'Updating…' : isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
        {artist.bio && <div className="mt-8 border-t border-[var(--border)] pt-6"><h2 className="font-bold text-[var(--text)]">About</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--text-soft)]">{artist.bio}</p></div>}
        {actionError && <p role="alert" className="mt-5 text-sm text-rose-600 dark:text-rose-300">{actionError}</p>}
        {!canFollow && !isAuthenticated && <p className="mt-6 text-sm text-[var(--text-soft)]"><Link to="/login" className="font-semibold text-[var(--primary)]">Sign in</Link> as a fan to follow artists.</p>}
      </section>
    </div>
  )
}
