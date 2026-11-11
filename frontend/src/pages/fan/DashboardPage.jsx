import { useEffect, useState } from 'react'
import { ArrowRight, Heart, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import EventCard from '../../components/events/EventCard'
import { useAuth } from '../../context/AuthContext'
import { getEvents, getEventLikes } from '../../services/events.service'
import { followPromoter, getPromoters, unfollowPromoter } from '../../services/promoters.service'
import { getApiErrorMessage } from '../../utils/apiError'

const ACTIVITY_EVENT_LIMIT = 12
const PROMOTER_LIST_LIMIT = 6

export default function DashboardPage() {
  const { user } = useAuth()
  const [retryCount, setRetryCount] = useState(0)
  const [likedEvents, setLikedEvents] = useState([])
  const [promoters, setPromoters] = useState([])
  const [loading, setLoading] = useState(true)
  const [likesError, setLikesError] = useState('')
  const [promotersError, setPromotersError] = useState('')
  const [followedThisVisit, setFollowedThisVisit] = useState(() => new Set())
  const [followPending, setFollowPending] = useState('')
  const [followError, setFollowError] = useState('')
  const [followNotice, setFollowNotice] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    Promise.allSettled([getEvents({}, controller.signal), getPromoters(controller.signal)])
      .then(async ([eventsResult, promotersResult]) => {
        if (controller.signal.aborted) return

        if (promotersResult.status === 'fulfilled') {
          setPromoters(promotersResult.value.slice(0, PROMOTER_LIST_LIMIT))
          setPromotersError('')
        } else {
          setPromoters([])
          setPromotersError(
            getApiErrorMessage(promotersResult.reason, 'Promoter profiles could not be loaded.'),
          )
        }

        if (eventsResult.status === 'rejected') {
          setLikedEvents([])
          setLikesError(getApiErrorMessage(eventsResult.reason, 'Events could not be loaded.'))
          setLoading(false)
          return
        }

        const events = eventsResult.value.slice(0, ACTIVITY_EVENT_LIMIT)
        const likesResults = await Promise.allSettled(
          events.map((event) => getEventLikes(event.id, controller.signal)),
        )

        if (controller.signal.aborted) return

        const liked = []
        const failures = []
        likesResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            if (result.value.some((userId) => String(userId) === String(user.id))) {
              liked.push(events[index])
            }
          } else if (result.reason?.name !== 'CanceledError') {
            failures.push(result.reason)
          }
        })

        setLikedEvents(liked)
        setLikesError(
          failures.length
            ? 'Some like statuses could not be checked. The list includes only events whose status was confirmed.'
            : '',
        )
        setLoading(false)
      })

    return () => controller.abort()
  }, [retryCount, user.id])

  const retryLoad = () => {
    setLoading(true)
    setLikesError('')
    setPromotersError('')
    setRetryCount((current) => current + 1)
  }

  const handleFollow = async (promoter) => {
    const promoterId = String(promoter.id)
    const currentlyFollowing = followedThisVisit.has(promoterId)
    setFollowPending(promoterId)
    setFollowError('')
    setFollowNotice('')

    try {
      if (currentlyFollowing) {
        await unfollowPromoter(promoter.id)
        setFollowedThisVisit((current) => {
          const next = new Set(current)
          next.delete(promoterId)
          return next
        })
        setFollowNotice(`You unfollowed ${promoter.display_name}.`)
      } else {
        await followPromoter(promoter.id)
        setFollowedThisVisit((current) => new Set(current).add(promoterId))
        setFollowNotice(`You’re now following ${promoter.display_name}.`)
      }
    } catch (error) {
      setFollowError(getApiErrorMessage(error, 'Could not update your follow. Please try again.'))
    } finally {
      setFollowPending('')
    }
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Fan dashboard</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[var(--text)]">
            Welcome, {user.full_name}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Your saved events and the people behind your local scene.
          </p>
        </div>
        <button
          type="button"
          onClick={retryLoad}
          disabled={loading}
          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--primary)] disabled:opacity-60"
        >
          {loading ? 'Loading…' : 'Refresh activity'}
        </button>
      </header>

      <section aria-labelledby="liked-events-heading" aria-busy={loading}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">Your shortlist</p>
            <h2 id="liked-events-heading" className="mt-2 text-2xl font-bold text-[var(--text)]">
              Liked events
            </h2>
          </div>
          <Link
            to="/events"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)] hover:text-[var(--primary-strong)]"
          >
            Discover events
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <p className="mb-4 text-xs leading-5 text-[var(--text-soft)]">
          The current API has no fan-wide liked-events endpoint. This section checks like status for the first {ACTIVITY_EVENT_LIMIT} upcoming events using the available per-event endpoint.
        </p>

        {loading && (
          <div role="status" className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-soft)]">
            Checking your event activity…
          </div>
        )}

        {!loading && likesError && (
          <div role="alert" className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-6 text-[var(--text-soft)]">
            {likesError}
          </div>
        )}

        {!loading && !likesError && likedEvents.length === 0 && (
          <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center">
            <Heart size={23} className="mx-auto text-[var(--primary)]" aria-hidden="true" />
            <h3 className="mt-4 font-semibold text-[var(--text)]">No liked events found in this upcoming set.</h3>
            <p className="mt-2 text-sm text-[var(--text-soft)]">Explore events and like the ones you want to remember.</p>
          </div>
        )}

        {!loading && likedEvents.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {likedEvents.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        )}

        {!loading && likesError && likedEvents.length === 0 && (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-6 py-8 text-center">
            <p className="text-sm text-[var(--text-soft)]">The liked-event view is incomplete until like statuses can be confirmed.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="followed-promoters-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">Stay in the loop</p>
            <h2 id="followed-promoters-heading" className="mt-2 text-2xl font-bold text-[var(--text)]">
              Promoters to follow
            </h2>
          </div>
          <Link
            to="/#promoters"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)] hover:text-[var(--primary-strong)]"
          >
            See the local scene
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <p className="mb-4 text-xs leading-5 text-[var(--text-soft)]">
          The API supports follow and unfollow actions but doesn’t provide your followed-promoter list or current follow status. “Following” below reflects only actions confirmed during this visit.
        </p>

        {followError && (
          <p role="alert" className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-[var(--text)]">
            {followError}
          </p>
        )}
        {followNotice && (
          <p role="status" className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-[var(--text)]">
            {followNotice}
          </p>
        )}
        {promotersError && (
          <p role="alert" className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-[var(--text)]">
            {promotersError}
          </p>
        )}

        {!promotersError && promoters.length === 0 && (
          <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center">
            <UsersRound size={23} className="mx-auto text-[var(--primary)]" aria-hidden="true" />
            <h3 className="mt-4 font-semibold text-[var(--text)]">No promoter profiles are available yet.</h3>
          </div>
        )}

        {promoters.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {promoters.map((promoter) => {
              const isFollowing = followedThisVisit.has(String(promoter.id))

              return (
                <article key={promoter.id} className="flex items-start gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-[var(--primary)]">
                    <UsersRound size={19} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-[var(--text)]">{promoter.display_name}</h3>
                    {promoter.city && <p className="mt-1 text-sm text-[var(--text-soft)]">{promoter.city}</p>}
                    {promoter.bio && <p className="mt-2 line-clamp-2 text-sm leading-5 text-[var(--text-soft)]">{promoter.bio}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFollow(promoter)}
                    disabled={followPending === String(promoter.id)}
                    aria-pressed={isFollowing}
                    className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                      isFollowing
                        ? 'border border-[var(--border)] text-[var(--text)] hover:border-rose-400'
                        : 'bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)]'
                    }`}
                  >
                    {followPending === String(promoter.id)
                      ? 'Saving…'
                      : isFollowing
                        ? 'Following'
                        : 'Follow'}
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
