import { useEffect, useMemo, useState } from 'react'
import { format, isValid } from 'date-fns'
import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Heart,
  MapPin,
  Share2,
  Ticket,
  UsersRound,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSavedEvents } from '../../context/SavedEventsContext'
import {
  getEvent,
  getEventEngagement,
  getEventLikes,
  recordEventShare,
  setEventLiked,
} from '../../services/events.service'
import { getPromoters } from '../../services/promoters.service'
import { getApiErrorMessage } from '../../utils/apiError'

function formatEventDate(value, dateFormat) {
  const date = new Date(value)
  return isValid(date) ? format(date, dateFormat) : 'Date unavailable'
}

function EventDetailSkeleton() {
  return (
    <div aria-label="Loading event details" className="animate-pulse space-y-6">
      <div className="h-72 rounded-[2rem] bg-[var(--surface-strong)]" />
      <div className="h-8 w-2/3 rounded bg-[var(--surface-strong)]" />
      <div className="h-5 w-1/3 rounded bg-[var(--surface-strong)]" />
      <div className="h-40 rounded-3xl bg-[var(--surface-strong)]" />
    </div>
  )
}

export default function EventDetailPage() {
  const { eventId } = useParams()
  return <EventDetailContent key={eventId} eventId={eventId} />
}

function EventDetailContent({ eventId }) {
  const { user } = useAuth()
  const {
    savedIds,
    pendingIds,
    isLoaded: savedStateLoaded,
    loadError: savedLoadError,
    toggleSaved,
  } = useSavedEvents()
  const [retryCount, setRetryCount] = useState(0)
  const [event, setEvent] = useState(null)
  const [promoter, setPromoter] = useState(null)
  const [engagement, setEngagement] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [engagementMessage, setEngagementMessage] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [likedByMe, setLikedByMe] = useState(false)
  const [likePending, setLikePending] = useState(false)
  const [saveError, setSaveError] = useState('')
  const hasUserIdentity = Boolean(user?.id)
  const canSave = user?.role === 'fan'
  const isSaved = event ? savedIds.has(String(event.id)) : false
  const savePending = event ? pendingIds.has(String(event.id)) : false
  const isLiked = hasUserIdentity && likedByMe

  const eventStatus = useMemo(() => {
    if (!event) return ''
    return event.status === 'cancelled' ? 'Cancelled' : event.status
  }, [event])

  useEffect(() => {
    const controller = new AbortController()

    getEvent(eventId, controller.signal)
      .then(async (loadedEvent) => {
        if (controller.signal.aborted) return
        setEvent(loadedEvent)

        const [engagementResult, promotersResult] = await Promise.allSettled([
          getEventEngagement(eventId, controller.signal),
          getPromoters(controller.signal),
        ])

        if (controller.signal.aborted) return

        if (engagementResult.status === 'fulfilled') {
          setEngagement(engagementResult.value)
        } else {
          setEngagementMessage(
            getApiErrorMessage(engagementResult.reason, 'Engagement details are unavailable.'),
          )
        }

        if (promotersResult.status === 'fulfilled') {
          const matchingPromoter = promotersResult.value.find(
            (profile) => String(profile.user_id) === String(loadedEvent.promoter_id),
          )
          setPromoter(matchingPromoter || null)
        } else {
          setEngagementMessage((current) =>
            current
              ? `${current} Promoter information could not be loaded.`
              : 'Promoter information could not be loaded.',
          )
        }
      })
      .catch((error) => {
        if (error.name !== 'CanceledError') {
          setErrorMessage(getApiErrorMessage(error, 'Could not load this event. Please try again.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [eventId, retryCount])

  useEffect(() => {
    if (!event || !hasUserIdentity) {
      return undefined
    }

    const controller = new AbortController()

    getEventLikes(event.id, controller.signal)
      .then((likedUserIds) => {
        setLikedByMe(likedUserIds.some((id) => String(id) === String(user.id)))
      })
      .catch((error) => {
        if (error.name !== 'CanceledError') {
          setActionError(getApiErrorMessage(error, 'Could not check your event like status.'))
        }
      })

    return () => controller.abort()
  }, [event, hasUserIdentity, user?.id])

  const handleLike = async () => {
    if (!event || !hasUserIdentity || likePending) return

    setLikePending(true)
    setActionError('')

    try {
      const likeCount = await setEventLiked(event.id, !isLiked)
      setLikedByMe((current) => !current)
      setEngagement((current) => ({
        ...current,
        like_count: likeCount,
      }))
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Could not update your like. Please try again.'))
    } finally {
      setLikePending(false)
    }
  }

  const handleSave = async () => {
    if (!event || !canSave || !savedStateLoaded || savePending) return

    setSaveError('')
    try {
      await toggleSaved(event)
    } catch (error) {
      setSaveError(getApiErrorMessage(error, 'Could not update this saved event. Please try again.'))
    }
  }

  const handleShare = async () => {
    if (!event) return

    setActionMessage('')
    setActionError('')
    const eventUrl = window.location.href
    let platform = 'clipboard'

    try {
      if (navigator.share) {
        await navigator.share({
          title: event.title,
          text: event.description || `Discover ${event.title} on EchoRoom AI.`,
          url: eventUrl,
        })
        platform = 'web-share'
        setActionMessage('Event shared.')
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(eventUrl)
        setActionMessage('Event link copied.')
      } else {
        setActionError('Sharing is not available in this browser.')
        return
      }

      if (hasUserIdentity) {
        try {
          const shareCount = await recordEventShare(event.id, platform)
          setEngagement((current) => ({ ...current, share_count: shareCount }))
        } catch (error) {
          setActionMessage(
            `Event shared, but the share could not be recorded: ${getApiErrorMessage(error, 'tracking is unavailable.')}`,
          )
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        setActionError(getApiErrorMessage(error, 'Could not share this event. Please try again.'))
      }
    }
  }

  if (loading) return <EventDetailSkeleton />

  if (errorMessage || !event) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-8 text-center">
        <h1 className="text-xl font-bold text-[var(--text)]">
          {errorMessage.includes('Event not found') ? 'Event not found' : 'Event details unavailable'}
        </h1>
        <p role="alert" className="mt-2 text-sm text-[var(--text-soft)]">
          {errorMessage || 'The requested event could not be found.'}
        </p>
        <Link
          to="/events"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-strong)]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to events
        </Link>
        <button
          type="button"
          onClick={() => {
            setErrorMessage('')
            setLoading(true)
            setRetryCount((current) => current + 1)
          }}
          className="ml-3 mt-6 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:border-[var(--primary)]"
        >
          Try again
        </button>
      </div>
    )
  }

  const artists = Array.isArray(event.artists) ? event.artists : []

  return (
    <div className="space-y-7">
      <Link
        to="/events"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-soft)] transition hover:text-[var(--primary)]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        All events
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <main className="space-y-6">
          <section className="relative flex min-h-64 flex-col justify-end overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[radial-gradient(circle_at_78%_10%,_rgba(217,70,239,0.42),_transparent_34%),linear-gradient(135deg,_rgba(124,58,237,0.25),_rgba(15,23,42,0.06))] p-6 sm:min-h-80 sm:p-9">
            <div className="absolute right-8 top-8 text-[var(--primary)]/30" aria-hidden="true">
              <CalendarDays size={92} strokeWidth={0.8} />
            </div>
            <div className="relative">
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface)]/80 px-3 py-1 text-xs font-semibold capitalize text-[var(--text)] backdrop-blur">
                  {eventStatus || 'Event'}
                </span>
                {event.verified_at && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                    <CheckCircle2 size={13} aria-hidden="true" />
                    Verified
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-[var(--text-soft)]">
                {event.host || event.city || 'EchoRoom event'}
              </p>
              <h1 className="mt-2 max-w-3xl text-4xl font-black tracking-[-0.06em] text-[var(--text)] sm:text-5xl">
                {event.title}
              </h1>
              {artists.length > 0 && (
                <p className="mt-3 text-base text-[var(--text-soft)]">{artists.join(' · ')}</p>
              )}
            </div>
          </section>

          {event.status === 'cancelled' && (
            <div role="status" className="rounded-2xl border border-rose-500/30 bg-rose-500/5 px-5 py-4 text-sm font-medium text-rose-600 dark:text-rose-300">
              This event has been cancelled.
            </div>
          )}

          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
            <h2 className="text-xl font-bold text-[var(--text)]">About this event</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--text-soft)]">
              {event.description || 'The promoter has not provided an event description.'}
            </p>
            {artists.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-[var(--text)]">Artists</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {artists.map((artist) => (
                    <li key={artist} className="rounded-full bg-[var(--surface-strong)] px-3 py-1.5 text-sm text-[var(--text-soft)]">
                      {artist}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <h2 className="text-xl font-bold text-[var(--text)]">Promoter</h2>
                {promoter ? (
                  <>
                    <p className="mt-3 font-semibold text-[var(--text)]">{promoter.display_name}</p>
                    {promoter.city && (
                      <p className="mt-1 text-sm text-[var(--text-soft)]">{promoter.city}</p>
                    )}
                    {promoter.bio && (
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">
                        {promoter.bio}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-3 text-sm text-[var(--text-soft)]">
                    A public promoter profile isn’t available for this event.
                  </p>
                )}
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 text-[var(--primary)]">
                <UsersRound size={20} aria-hidden="true" />
              </div>
            </div>
          </section>
        </main>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[var(--text)]">Event details</h2>
            <dl className="mt-5 space-y-5">
              <div className="flex gap-3">
                <CalendarDays size={19} className="mt-0.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-soft)]">Date</dt>
                  <dd className="mt-1 text-sm font-semibold text-[var(--text)]">
                    {formatEventDate(event.start_at, 'EEEE, MMMM d, yyyy')}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <Clock3 size={19} className="mt-0.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-soft)]">Time</dt>
                  <dd className="mt-1 text-sm font-semibold text-[var(--text)]">
                    {formatEventDate(event.start_at, 'h:mm a')}
                    {event.end_at && ` – ${formatEventDate(event.end_at, 'h:mm a')}`}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin size={19} className="mt-0.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-soft)]">Location</dt>
                  <dd className="mt-1 text-sm font-semibold text-[var(--text)]">
                    {[event.venue, event.city].filter(Boolean).join(', ') || 'Location unavailable'}
                  </dd>
                </div>
              </div>
              {event.ticket_price_info && (
                <div className="flex gap-3">
                  <Ticket size={19} className="mt-0.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-soft)]">Tickets</dt>
                    <dd className="mt-1 text-sm font-semibold text-[var(--text)]">{event.ticket_price_info}</dd>
                  </div>
                </div>
              )}
            </dl>
            {event.booking_info && (
              <div className="mt-5 border-t border-[var(--border)] pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-soft)]">Booking information</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text)]">{event.booking_info}</p>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-lg font-bold text-[var(--text)]">Join the conversation</h2>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleLike}
                disabled={!hasUserIdentity || likePending}
                aria-pressed={isLiked}
                title={!hasUserIdentity ? 'Event likes require a signed-in account.' : undefined}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Heart size={17} fill={isLiked ? 'currentColor' : 'none'} aria-hidden="true" />
                {likePending ? 'Saving…' : isLiked ? 'Liked' : 'Like'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave || !savedStateLoaded || savePending}
                aria-pressed={isSaved}
                title={!canSave ? 'Sign in as a fan to save events.' : savedLoadError || undefined}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
                {savePending ? 'Saving…' : isSaved ? 'Saved' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
              >
                <Share2 size={17} aria-hidden="true" />
                Share
              </button>
            </div>
            {!hasUserIdentity && (
              <p className="mt-3 text-xs leading-5 text-[var(--text-soft)]">
                Sign in to like events.
              </p>
            )}
            {engagement && (
              <dl className="mt-5 flex justify-between border-t border-[var(--border)] pt-4 text-center">
                <div>
                  <dt className="text-xs text-[var(--text-soft)]">Likes</dt>
                  <dd className="mt-1 font-bold text-[var(--text)]">{engagement.like_count}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-soft)]">Views</dt>
                  <dd className="mt-1 font-bold text-[var(--text)]">{engagement.view_count}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-soft)]">Shares</dt>
                  <dd className="mt-1 font-bold text-[var(--text)]">{engagement.share_count}</dd>
                </div>
              </dl>
            )}
            {engagementMessage && (
              <p className="mt-4 text-xs leading-5 text-[var(--text-soft)]">{engagementMessage}</p>
            )}
            {actionMessage && (
              <p role="status" className="mt-4 text-sm text-[var(--primary)]">{actionMessage}</p>
            )}
            {actionError && (
              <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-300">{actionError}</p>
            )}
            {savedLoadError && canSave && (
              <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-300">
                Saved status unavailable: {savedLoadError}
              </p>
            )}
            {saveError && (
              <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-300">{saveError}</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
