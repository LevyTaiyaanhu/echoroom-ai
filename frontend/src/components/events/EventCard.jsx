import { useState } from 'react'
import { format, isValid } from 'date-fns'
import { ArrowRight, Bookmark, CalendarDays, Heart, MapPin, Music2, Share2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSavedEvents } from '../../context/SavedEventsContext'
import { getEventLikes, recordEventShare, setEventLiked } from '../../services/events.service'
import { getApiErrorMessage } from '../../utils/apiError'

function getEventDate(value) {
  const date = new Date(value)

  return isValid(date) ? format(date, 'EEE, MMM d · h:mm a') : 'Date unavailable'
}

export default function EventCard({ event }) {
  const artists = Array.isArray(event.artists) ? event.artists.join(', ') : ''
  const { isAuthenticated, user } = useAuth()
  const {
    savedIds,
    pendingIds,
    isLoaded: savedStateLoaded,
    loadError: savedLoadError,
    toggleSaved,
  } = useSavedEvents()
  const [shareMessage, setShareMessage] = useState('')
  const [shareError, setShareError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [likeError, setLikeError] = useState('')
  const [liked, setLiked] = useState(null)
  const [liking, setLiking] = useState(false)
  const [sharing, setSharing] = useState(false)
  const canSave = isAuthenticated && user?.role === 'fan'
  const canLike = isAuthenticated && user?.role === 'fan'
  const isSaved = savedIds.has(String(event.id))
  const savePending = pendingIds.has(String(event.id))

  const handleSave = async () => {
    if (!canSave || !savedStateLoaded || savePending) return

    setSaveError('')
    try {
      await toggleSaved(event)
    } catch (error) {
      setSaveError(getApiErrorMessage(error, 'Could not update this saved event. Please try again.'))
    }
  }

  const handleLike = async () => {
    if (!canLike || liking) return

    setLiking(true)
    setLikeError('')
    try {
      const currentLike = liked === null
        ? (await getEventLikes(event.id)).some((userId) => String(userId) === String(user.id))
        : liked
      await setEventLiked(event.id, !currentLike)
      setLiked(!currentLike)
    } catch (error) {
      setLikeError(getApiErrorMessage(error, 'Could not update this event like. Please try again.'))
    } finally {
      setLiking(false)
    }
  }

  const handleShare = async () => {
    if (sharing) return

    setSharing(true)
    setShareMessage('')
    setShareError('')
    const eventUrl = new URL(`/events/${encodeURIComponent(event.id)}`, window.location.origin).toString()
    let platform = 'clipboard'

    try {
      if (navigator.share) {
        await navigator.share({
          title: event.title,
          text: event.description || `Discover ${event.title} on EchoRoom AI.`,
          url: eventUrl,
        })
        platform = 'web-share'
        setShareMessage('Event shared.')
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(eventUrl)
        setShareMessage('Event link copied.')
      } else {
        throw new Error('Sharing is not available in this browser.')
      }

      if (isAuthenticated) {
        try {
          await recordEventShare(event.id, platform)
        } catch (error) {
          setShareMessage(
            `Shared, but tracking is unavailable: ${getApiErrorMessage(error, 'the share could not be recorded.')}`,
          )
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        setShareError(getApiErrorMessage(error, 'Could not share this event. Please try again.'))
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <article className="group rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:-translate-y-1 hover:border-[var(--primary)] hover:shadow-[var(--shadow)]">
      <Link
        to={`/events/${encodeURIComponent(event.id)}`}
        className="block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        <div className="mb-5 flex min-h-32 items-end justify-between overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_78%_10%,_rgba(217,70,239,0.35),_transparent_34%),linear-gradient(135deg,_rgba(124,58,237,0.18),_rgba(15,23,42,0.04))] p-4">
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)]/80 px-3 py-1 text-xs font-semibold capitalize text-[var(--text-soft)] backdrop-blur">
            {event.status || 'Event'}
          </span>
          <Music2 size={26} className="text-[var(--primary)] transition group-hover:scale-110" aria-hidden="true" />
        </div>

        <h3 className="line-clamp-2 text-lg font-bold text-[var(--text)]">{event.title}</h3>
        {artists && <p className="mt-1 line-clamp-1 text-sm text-[var(--text-soft)]">{artists}</p>}

        <dl className="mt-4 space-y-2.5 text-sm text-[var(--text-soft)]">
          <div className="flex items-start gap-2">
            <CalendarDays size={16} className="mt-0.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
            <dt className="sr-only">Date</dt>
            <dd>{getEventDate(event.start_at)}</dd>
          </div>
          <div className="flex items-start gap-2">
            <MapPin size={16} className="mt-0.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
            <dt className="sr-only">Venue and city</dt>
            <dd>{[event.venue, event.city].filter(Boolean).join(', ') || 'Location unavailable'}</dd>
          </div>
        </dl>

        {event.ticket_price_info && (
          <p className="mt-4 border-t border-[var(--border)] pt-3 text-sm font-semibold text-[var(--primary)]">
            {event.ticket_price_info}
          </p>
        )}
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
        <Link
          to={`/events/${encodeURIComponent(event.id)}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-[var(--primary)] transition hover:bg-violet-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          View details
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleLike}
            disabled={!canLike || liking}
            title={!canLike ? 'Sign in as a fan to like events.' : undefined}
            aria-pressed={liked === true}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border)] px-3 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Heart size={15} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
            {liking ? 'Updating…' : liked ? 'Liked' : 'Like'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || !savedStateLoaded || savePending}
            title={!canSave ? 'Sign in as a fan to save events.' : savedLoadError || undefined}
            aria-pressed={isSaved}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border)] px-3 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Bookmark size={15} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
            {savePending ? 'Saving…' : isSaved ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border)] px-3 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:cursor-wait disabled:opacity-60"
          >
            <Share2 size={15} aria-hidden="true" />
            {sharing ? 'Sharing…' : 'Share'}
          </button>
        </div>
      </div>
      {savedLoadError && canSave && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-300">Saved status unavailable: {savedLoadError}</p>}
      {saveError && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-300">{saveError}</p>}
      {likeError && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-300">{likeError}</p>}
      {shareMessage && <p role="status" className="mt-2 text-xs text-[var(--primary)]">{shareMessage}</p>}
      {shareError && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-300">{shareError}</p>}
    </article>
  )
}
