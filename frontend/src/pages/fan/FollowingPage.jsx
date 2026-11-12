import { useEffect, useState } from 'react'
import { ArrowRight, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import EventCard from '../../components/events/EventCard'
import { getFollowing, getFollowingEvents } from '../../services/following.service'
import { unfollowPromoter } from '../../services/promoters.service'
import { unfollowArtist } from '../../services/following.service'
import { getApiErrorMessage } from '../../utils/apiError'

export default function FollowingPage() {
  const [following, setFollowing] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [pendingId, setPendingId] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([getFollowing(controller.signal), getFollowingEvents(controller.signal)])
      .then(([accounts, followedEvents]) => {
        setFollowing(accounts)
        setEvents(followedEvents)
        setError('')
      })
      .catch((requestError) => {
        if (requestError.name !== 'CanceledError') {
          setError(getApiErrorMessage(requestError, 'Your followed accounts could not be loaded.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [reload])

  const handleUnfollow = async (account) => {
    const id = `${account.type}:${account.id}`
    if (pendingId) return

    setPendingId(id)
    setActionError('')
    try {
      if (account.type === 'artist') {
        await unfollowArtist(account.artist_id)
      } else {
        await unfollowPromoter(account.promoter_id)
      }

      setFollowing((current) => {
        const key = account.type === 'artist' ? 'artists' : 'promoters'
        const nextList = current[key].filter((item) => String(item.id) !== String(account.id))
        return {
          ...current,
          [key]: nextList,
          counts: { ...current.counts, [key]: nextList.length },
        }
      })
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'Could not update this follow. Please try again.'))
    } finally {
      setPendingId('')
    }
  }

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Stay in the loop</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-[var(--text)]">Following</h1>
        <p className="mt-3 text-base leading-7 text-[var(--text-soft)]">
          Your followed artists and promoters, with their upcoming event listings.
        </p>
      </header>

      {loading && (
        <div role="status" className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-soft)]">
          Loading your followed accounts…
        </div>
      )}
      {!loading && error && (
        <div role="alert" className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-6">
          <p className="text-sm text-[var(--text-soft)]">{error}</p>
          <button type="button" onClick={() => { setLoading(true); setReload((count) => count + 1) }} className="mt-4 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)]">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && following && (
        <>
          {actionError && <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-600 dark:text-rose-300">{actionError}</p>}
          <section aria-labelledby="followed-accounts-heading">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="followed-accounts-heading" className="text-2xl font-bold text-[var(--text)]">Your accounts</h2>
                <p className="mt-1 text-sm text-[var(--text-soft)]">
                  {following.counts.artists} artists · {following.counts.promoters} promoters
                </p>
              </div>
              <Link to="/artists" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)]">
                Discover artists <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            {following.artists.length + following.promoters.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center">
                <UsersRound size={24} className="mx-auto text-[var(--primary)]" aria-hidden="true" />
                <h3 className="mt-4 font-semibold text-[var(--text)]">You’re not following anyone yet</h3>
                <p className="mt-2 text-sm text-[var(--text-soft)]">Find an artist or promoter to keep up with their events.</p>
                <Link to="/artists" className="mt-4 inline-flex rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">Explore artists</Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...following.artists, ...following.promoters].map((account) => {
                  const name = account.type === 'artist' ? account.stage_name : account.display_name
                  const accountId = account.type === 'artist' ? account.artist_id : account.promoter_id
                  const id = `${account.type}:${account.id}`
                  return (
                    <article key={id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">{account.type}</p>
                      <h3 className="mt-2 text-lg font-bold text-[var(--text)]">{name}</h3>
                      <p className="mt-1 text-sm text-[var(--text-soft)]">
                        {[account.genre, account.city].filter(Boolean).join(' · ') || 'Profile details unavailable'}
                      </p>
                      {account.type === 'artist' && (
                        <Link to={`/artists/${encodeURIComponent(accountId)}`} className="mt-4 inline-flex text-sm font-semibold text-[var(--primary)]">
                          View profile
                        </Link>
                      )}
                      <button
                        type="button"
                        disabled={Boolean(pendingId)}
                        onClick={() => handleUnfollow(account)}
                        className="mt-4 block min-h-10 rounded-full border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text)] hover:border-rose-500 hover:text-rose-600 disabled:opacity-60"
                      >
                        {pendingId === id ? 'Updating…' : 'Following · Unfollow'}
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="followed-events-heading">
            <h2 id="followed-events-heading" className="mb-5 text-2xl font-bold text-[var(--text)]">Upcoming from your follows</h2>
            {events.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-soft)]">
                No upcoming events from followed accounts are available.
              </p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => <EventCard key={event.id} event={event} />)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
