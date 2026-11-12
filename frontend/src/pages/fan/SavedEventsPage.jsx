import { Bookmark, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import EventCard from '../../components/events/EventCard'
import { useSavedEvents } from '../../context/SavedEventsContext'

export default function SavedEventsPage() {
  const { savedEvents, isLoaded, loadError, retry } = useSavedEvents()

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Your shortlist</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-[var(--text)]">Saved events</h1>
        <p className="mt-3 text-base leading-7 text-[var(--text-soft)]">
          Keep the events you are interested in close at hand.
        </p>
      </header>

      {!isLoaded && (
        <div role="status" className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-soft)]">
          Loading your saved events…
        </div>
      )}

      {isLoaded && loadError && (
        <div role="alert" className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-6">
          <p className="font-semibold text-[var(--text)]">Saved events are unavailable</p>
          <p className="mt-2 text-sm text-[var(--text-soft)]">{loadError}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text)] hover:border-[var(--primary)]"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Try again
          </button>
        </div>
      )}

      {isLoaded && !loadError && savedEvents.length === 0 && (
        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
          <Bookmark size={26} className="mx-auto text-[var(--primary)]" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-bold text-[var(--text)]">No saved events yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-soft)]">
            Save an event from its card or details page and it will appear here.
          </p>
          <Link
            to="/events"
            className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[var(--primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--primary-strong)]"
          >
            Explore events
          </Link>
        </div>
      )}

      {isLoaded && !loadError && savedEvents.length > 0 && (
        <>
          <p className="text-sm text-[var(--text-soft)]">
            {savedEvents.length} {savedEvents.length === 1 ? 'event' : 'events'} saved. Use the Saved button to remove one.
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {savedEvents.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        </>
      )}
    </div>
  )
}
