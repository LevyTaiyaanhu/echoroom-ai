import { useEffect, useState } from 'react'
import { format, isValid } from 'date-fns'
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Eye,
  Heart,
  MapPin,
  Pencil,
  Plus,
  Share2,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import PromoterEventForm from '../../components/events/PromoterEventForm'
import { useAuth } from '../../context/AuthContext'
import { cancelEvent, createEvent, updateEvent } from '../../services/events.service'
import {
  getMyPromoterEngagement,
  getMyPromoterEvents,
  getMyPromoterFollowers,
  getMyPromoterProfile,
} from '../../services/promoter.service'
import { getApiErrorMessage } from '../../utils/apiError'

const initialEngagement = {
  total_events: 0,
  active_events: 0,
  total_likes: 0,
  total_views: 0,
  total_shares: 0,
}

function formatEventDate(value) {
  const date = new Date(value)
  return isValid(date) ? format(date, 'EEE, MMM d, yyyy · h:mm a') : 'Date unavailable'
}

function MetricCard({ label, value, icon: Icon, detail }) {
  return (
    <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--text-soft)]">{label}</p>
          <p className="mt-4 text-3xl font-black tracking-[-0.06em] text-[var(--text)]">
            {Number(value).toLocaleString()}
          </p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10 text-[var(--primary)]">
          <Icon size={19} aria-hidden="true" />
        </span>
      </div>
      {detail && <p className="mt-2 text-xs leading-5 text-[var(--text-soft)]">{detail}</p>}
    </article>
  )
}

export default function PromoterDashboardPage() {
  const { user } = useAuth()
  const [retryCount, setRetryCount] = useState(0)
  const [events, setEvents] = useState([])
  const [engagement, setEngagement] = useState(initialEngagement)
  const [followers, setFollowers] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [eventsError, setEventsError] = useState('')
  const [dataError, setDataError] = useState('')
  const [editorEvent, setEditorEvent] = useState(undefined)
  const [savingEvent, setSavingEvent] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelError, setCancelError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    Promise.allSettled([
      getMyPromoterEvents(controller.signal),
      getMyPromoterEngagement(controller.signal),
      getMyPromoterFollowers(controller.signal),
      getMyPromoterProfile(user.id, controller.signal),
    ]).then(([eventResult, engagementResult, followerResult, profileResult]) => {
      if (controller.signal.aborted) return

      if (eventResult.status === 'fulfilled') {
        setEvents(eventResult.value)
        setEventsError('')
      } else {
        setEvents([])
        setEventsError(getApiErrorMessage(eventResult.reason, 'Your events could not be loaded.'))
      }

      const failures = []
      if (engagementResult.status === 'fulfilled') {
        setEngagement(engagementResult.value)
      } else {
        failures.push(getApiErrorMessage(engagementResult.reason, 'Engagement analytics are unavailable.'))
      }
      if (followerResult.status === 'fulfilled') {
        setFollowers(followerResult.value)
      } else {
        failures.push(getApiErrorMessage(followerResult.reason, 'Follower count is unavailable.'))
      }
      if (profileResult.status === 'fulfilled') {
        setProfile(profileResult.value)
      } else {
        failures.push(getApiErrorMessage(profileResult.reason, 'Promoter profile details are unavailable.'))
      }

      setDataError(failures.join(' '))
      setLoading(false)
    })

    return () => controller.abort()
  }, [retryCount, user.id])

  const reloadDashboard = () => {
    setLoading(true)
    setDataError('')
    setEventsError('')
    setRetryCount((current) => current + 1)
  }

  const handleSaveEvent = async (eventDetails) => {
    setSavingEvent(true)
    setSaveError('')

    try {
      if (editorEvent) {
        const updatedEvent = await updateEvent(editorEvent.id, eventDetails)
        setEvents((current) => current.map((event) => (
          String(event.id) === String(updatedEvent.id) ? { ...event, ...updatedEvent } : event
        )))
      } else {
        const createdEvent = await createEvent(eventDetails)
        setEvents((current) => [...current, createdEvent].sort(
          (first, second) => new Date(first.start_at) - new Date(second.start_at),
        ))
        setEngagement((current) => ({
          ...current,
          total_events: current.total_events + 1,
          active_events: current.active_events + (createdEvent.status === 'active' ? 1 : 0),
        }))
      }

      setEventsError('')
      setEditorEvent(undefined)
    } catch (error) {
      setSaveError(getApiErrorMessage(error, 'Could not save this event. Please try again.'))
    } finally {
      setSavingEvent(false)
    }
  }

  const handleCancelEvent = async () => {
    if (!cancelTarget) return

    setCancelError('')
    try {
      const cancelled = await cancelEvent(cancelTarget.id)
      setEvents((current) => current.map((event) => (
        String(event.id) === String(cancelled.id)
          ? { ...event, status: cancelled.status, updated_at: cancelled.updated_at }
          : event
      )))
      if (cancelTarget.status === 'active') {
        setEngagement((current) => ({
          ...current,
          active_events: Math.max(0, current.active_events - 1),
        }))
      }
      setCancelTarget(null)
    } catch (error) {
      setCancelError(getApiErrorMessage(error, 'Could not cancel this event. Please try again.'))
    }
  }

  const openNewEventForm = () => {
    setSaveError('')
    setEditorEvent(null)
  }

  const openEditEventForm = (event) => {
    setSaveError('')
    setEditorEvent(event)
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Promoter workspace</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[var(--text)]">
            Welcome, {profile?.display_name || user.full_name}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            {profile?.city || user.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/promoter/profile"
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--primary)]"
          >
            Edit profile
          </Link>
          <button
            type="button"
            onClick={openNewEventForm}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
          >
            <Plus size={17} aria-hidden="true" />
            Create event
          </button>
        </div>
      </header>

      {dataError && (
        <div role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-6 text-[var(--text-soft)]">
          Some dashboard data is unavailable: {dataError}
          <button
            type="button"
            onClick={reloadDashboard}
            className="ml-3 font-semibold text-[var(--primary)] underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}

      <section aria-label="Promoter engagement overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Total events" value={engagement.total_events} icon={CalendarDays} />
        <MetricCard label="Active events" value={engagement.active_events} icon={CheckCircle2} />
        <MetricCard label="Event likes" value={engagement.total_likes} icon={Heart} />
        <MetricCard
          label="View estimates"
          value={engagement.total_views}
          icon={Eye}
          detail="Estimate only; not attendance."
        />
        <MetricCard
          label="Share clicks"
          value={engagement.total_shares}
          icon={Share2}
          detail="Click activity; not confirmed delivery."
        />
        <MetricCard
          label="Followers"
          value={followers ?? 0}
          icon={UsersRound}
          detail={followers === null ? 'Follower data is not available.' : 'People following your profile'}
        />
      </section>

      <section aria-labelledby="managed-events-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">Your lineup</p>
            <h2 id="managed-events-heading" className="mt-2 text-2xl font-bold text-[var(--text)]">Manage events</h2>
          </div>
          {!loading && !eventsError && (
            <span className="text-sm text-[var(--text-soft)]">{events.length} {events.length === 1 ? 'event' : 'events'}</span>
          )}
        </div>

        {loading && (
          <div role="status" className="grid animate-pulse gap-4 md:grid-cols-2">
            {[0, 1].map((item) => <div key={item} className="h-52 rounded-3xl bg-[var(--surface-strong)]" />)}
            <span className="sr-only">Loading your events</span>
          </div>
        )}

        {!loading && eventsError && (
          <div role="alert" className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-6">
            <h3 className="font-semibold text-[var(--text)]">Your event list couldn’t be loaded</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{eventsError}</p>
            <p className="mt-2 text-xs leading-5 text-[var(--text-soft)]">
              The frontend uses the documented promoter-events endpoint; check that it is available in the connected backend.
            </p>
            <button
              type="button"
              onClick={reloadDashboard}
              className="mt-4 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:border-[var(--primary)]"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !eventsError && events.length === 0 && (
          <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
            <BarChart3 size={25} className="mx-auto text-[var(--primary)]" aria-hidden="true" />
            <h3 className="mt-4 font-semibold text-[var(--text)]">No events yet</h3>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Create an event to start building your lineup.
            </p>
            <button
              type="button"
              onClick={openNewEventForm}
              className="mt-5 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              Create your first event
            </button>
          </div>
        )}

        {!loading && !eventsError && events.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {events.map((event) => (
              <article key={event.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-semibold capitalize text-[var(--primary)]">
                      {event.status || 'unknown'}
                    </span>
                    <h3 className="mt-3 line-clamp-2 text-lg font-bold text-[var(--text)]">{event.title}</h3>
                  </div>
                  <CalendarDays size={20} className="shrink-0 text-[var(--primary)]" aria-hidden="true" />
                </div>

                <div className="mt-4 space-y-2 text-sm text-[var(--text-soft)]">
                  <p>{formatEventDate(event.start_at)}</p>
                  <p className="flex items-center gap-2">
                    <MapPin size={15} className="shrink-0 text-[var(--primary)]" aria-hidden="true" />
                    {[event.venue, event.city].filter(Boolean).join(', ')}
                  </p>
                </div>

                {event.verified_at && (
                  <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-300">
                    <CheckCircle2 size={14} aria-hidden="true" />
                    Verified
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                  <Link
                    to={`/events/${encodeURIComponent(event.id)}`}
                    className="rounded-full border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text)] hover:border-[var(--primary)]"
                  >
                    View event
                  </Link>
                  <button
                    type="button"
                    disabled={event.status === 'cancelled' || event.can_edit === false}
                    onClick={() => openEditEventForm(event)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text)] hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Pencil size={14} aria-hidden="true" />
                    Edit
                  </button>
                  {event.status !== 'cancelled' && (
                    <button
                      type="button"
                      disabled={event.can_edit === false}
                      onClick={() => {
                        setCancelError('')
                        setCancelTarget(event)
                      }}
                      className="rounded-full border border-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/5 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300"
                    >
                      Cancel event
                    </button>
                  )}
                  {event.can_edit === false && (
                    <span className="self-center text-xs text-[var(--text-soft)]">Only event owners can edit.</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--text-soft)]">
        AI can extract event details from a flyer while you create or edit an event. The current event API does not
        attach or store the original flyer image.
      </p>

      {editorEvent !== undefined && (
        <PromoterEventForm
          key={editorEvent?.id || 'new-event'}
          event={editorEvent}
          saving={savingEvent}
          error={saveError}
          onSubmit={handleSaveEvent}
          onCancel={() => {
            if (!savingEvent) setEditorEvent(undefined)
          }}
        />
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-event-title"
            className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
          >
            <h2 id="cancel-event-title" className="text-xl font-bold text-[var(--text)]">Cancel this event?</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
              “{cancelTarget.title}” will be marked cancelled. The event record will remain in the system.
            </p>
            {cancelError && <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-300">{cancelError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)]"
              >
                Keep event
              </button>
              <button
                type="button"
                onClick={handleCancelEvent}
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Confirm cancellation
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
