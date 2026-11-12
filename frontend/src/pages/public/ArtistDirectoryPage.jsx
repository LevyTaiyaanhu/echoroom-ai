import { useEffect, useState } from 'react'
import { MapPin, Music2, Search, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { followArtist, getFollowing, unfollowArtist } from '../../services/following.service'
import { getArtists } from '../../services/artists.service'
import { getApiErrorMessage } from '../../utils/apiError'

export default function ArtistDirectoryPage() {
  const { isAuthenticated, user } = useAuth()
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [artists, setArtists] = useState([])
  const [followedIds, setFollowedIds] = useState(new Set())
  const [followingLoaded, setFollowingLoaded] = useState(false)
  const [loadedRequest, setLoadedRequest] = useState('')
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [pendingId, setPendingId] = useState('')
  const [reload, setReload] = useState(0)
  const canFollow = isAuthenticated && user?.role === 'fan'
  const requestKey = `${submittedQuery}:${canFollow}:${reload}`
  const loading = loadedRequest !== requestKey

  useEffect(() => {
    const controller = new AbortController()
    const requests = [getArtists(submittedQuery ? { q: submittedQuery } : {}, controller.signal)]
    if (canFollow) requests.push(getFollowing(controller.signal))

    Promise.all(requests)
      .then(([profiles, following]) => {
        if (controller.signal.aborted) return
        setArtists(profiles)
        if (following) {
          setFollowedIds(new Set(following.artists.map((artist) => String(artist.artist_id))))
          setFollowingLoaded(true)
        } else {
          setFollowedIds(new Set())
          setFollowingLoaded(false)
        }
        setError('')
      })
      .catch((requestError) => {
        if (requestError.name !== 'CanceledError') {
          setError(getApiErrorMessage(requestError, 'Artist profiles could not be loaded.'))
          setFollowingLoaded(false)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedRequest(requestKey)
      })

    return () => controller.abort()
  }, [canFollow, reload, requestKey, submittedQuery])

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmittedQuery(query.trim())
  }

  const handleFollow = async (artist) => {
    if (!canFollow || !followingLoaded || pendingId) return
    const artistId = String(artist.id)
    const isFollowing = followedIds.has(artistId)
    setPendingId(artistId)
    setActionError('')
    try {
      if (isFollowing) {
        await unfollowArtist(artist.id)
        setFollowedIds((current) => {
          const next = new Set(current)
          next.delete(artistId)
          return next
        })
      } else {
        await followArtist(artist.id)
        setFollowedIds((current) => new Set(current).add(artistId))
      }
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'Could not update this follow. Please try again.'))
    } finally {
      setPendingId('')
    }
  }

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Find your sound</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-[var(--text)]">Zimbabwean artists</h1>
        <p className="mt-3 text-base leading-7 text-[var(--text-soft)]">Discover public artist profiles and follow the performers you want to keep up with.</p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row">
        <label className="flex min-h-11 flex-1 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3">
          <Search size={17} className="text-[var(--text-soft)]" aria-hidden="true" />
          <span className="sr-only">Search artists</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Artist name, genre, or city" className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[var(--text)] outline-none" />
        </label>
        <button type="submit" className="min-h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--primary-strong)]">Search artists</button>
      </form>

      {actionError && <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-600 dark:text-rose-300">{actionError}</p>}
      {loading && <div role="status" className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-soft)]">Loading artist profiles…</div>}
      {!loading && error && (
        <div role="alert" className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-6">
          <p className="text-sm text-[var(--text-soft)]">{error}</p>
          <button type="button" onClick={() => setReload((count) => count + 1)} className="mt-4 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold">Try again</button>
        </div>
      )}
      {!loading && !error && artists.length === 0 && (
        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center">
          <Music2 size={25} className="mx-auto text-[var(--primary)]" aria-hidden="true" />
          <h2 className="mt-4 font-semibold text-[var(--text)]">No public artist profiles found</h2>
          <p className="mt-2 text-sm text-[var(--text-soft)]">Try another search. Private profiles are not returned by the service.</p>
        </div>
      )}
      {!loading && !error && artists.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {artists.map((artist) => (
            <article key={artist.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="flex items-center gap-4">
                {artist.profile_picture_url ? (
                  <img src={artist.profile_picture_url} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-[var(--primary)]"><UserRound size={22} aria-hidden="true" /></div>
                )}
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-[var(--text)]">{artist.stage_name}</h2>
                  {artist.genre && <p className="truncate text-sm text-[var(--text-soft)]">{artist.genre}</p>}
                </div>
              </div>
              {artist.city && <p className="mt-4 flex items-center gap-2 text-sm text-[var(--text-soft)]"><MapPin size={15} aria-hidden="true" />{artist.city}</p>}
              {artist.bio && <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--text-soft)]">{artist.bio}</p>}
              <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                <Link to={`/artists/${encodeURIComponent(artist.id)}`} className="inline-flex min-h-10 items-center rounded-full border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text)] hover:border-[var(--primary)]">View profile</Link>
                {canFollow && (
                  <button
                    type="button"
                    disabled={!followingLoaded || Boolean(pendingId)}
                    onClick={() => handleFollow(artist)}
                    className="min-h-10 rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--primary-strong)] disabled:opacity-50"
                  >
                    {pendingId === String(artist.id) ? 'Updating…' : followedIds.has(String(artist.id)) ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
