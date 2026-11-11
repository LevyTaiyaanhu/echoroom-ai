import { useEffect, useState } from 'react'
import { addDays, format, startOfDay } from 'date-fns'
import { CalendarDays, Search, SlidersHorizontal, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { getDateBoundary } from '../../utils/eventFilters'
import EventCard from '../../components/events/EventCard'
import { getEvents } from '../../services/events.service'
import { getApiErrorMessage } from '../../utils/apiError'

function EventCardSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="h-32 rounded-2xl bg-[var(--surface-strong)]" />
      <div className="mt-5 h-5 w-3/4 rounded bg-[var(--surface-strong)]" />
      <div className="mt-3 h-4 w-1/2 rounded bg-[var(--surface-strong)]" />
      <div className="mt-6 h-4 w-2/3 rounded bg-[var(--surface-strong)]" />
    </div>
  )
}

const ZIMBABWE_CITIES = [
  'Harare',
  'Bulawayo',
  'Mutare',
  'Gweru',
  'Masvingo',
  'Chitungwiza',
  'Chinhoyi',
  'Kadoma',
  'Kwekwe',
  'Marondera',
  'Victoria Falls',
]

function dateInputValue(date) {
  return format(date, 'yyyy-MM-dd')
}

export default function ExploreEventsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryString = searchParams.toString()
  return (
    <ExploreEventsResults
      key={queryString}
      queryString={queryString}
      setSearchParams={setSearchParams}
    />
  )
}

function ExploreEventsResults({ queryString, setSearchParams }) {
  const initialParams = new URLSearchParams(queryString)
  const [filters, setFilters] = useState({
    q: initialParams.get('q') || '',
    city: initialParams.get('city') || '',
    from: initialParams.get('from') || '',
    to: initialParams.get('to') || '',
  })
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [filterError, setFilterError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  const applyFilters = (params) => {
    setFilterError('')
    setLoading(true)
    setErrorMessage('')

    if (params.toString() === queryString) {
      setRetryCount((current) => current + 1)
    } else {
      setSearchParams(params)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams(queryString)
    const request = Object.fromEntries(params.entries())
    if (request.from) request.from = getDateBoundary(request.from, false)
    if (request.to) request.to = getDateBoundary(request.to, true)

    getEvents(request, controller.signal)
      .then(setEvents)
      .catch((error) => {
        if (error.name !== 'CanceledError') {
          setEvents([])
          setErrorMessage(getApiErrorMessage(error, 'Could not load events. Please try again.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [queryString, retryCount])

  const handleSubmit = (event) => {
    event.preventDefault()
    setFilterError('')

    if (filters.from && filters.to && filters.to < filters.from) {
      setFilterError('The end date must be the same as or later than the start date.')
      return
    }

    const params = Object.fromEntries(
      Object.entries(filters)
        .map(([key, value]) => [key, value.trim()])
        .filter(([, value]) => value),
    )
    applyFilters(new URLSearchParams(params))
  }

  const handleRetry = () => {
    setLoading(true)
    setErrorMessage('')
    setRetryCount((current) => current + 1)
  }

  const setDatePreset = (preset) => {
    const params = new URLSearchParams(queryString)
    params.delete('from')
    params.delete('to')

    if (preset === 'today') {
      const today = dateInputValue(startOfDay(new Date()))
      params.set('from', today)
      params.set('to', today)
    } else if (preset === 'tomorrow') {
      const tomorrow = dateInputValue(addDays(startOfDay(new Date()), 1))
      params.set('from', tomorrow)
      params.set('to', tomorrow)
    } else if (preset === 'weekend') {
      const today = startOfDay(new Date())
      const day = today.getDay()
      const saturday = day === 0 ? today : addDays(today, (6 - day + 7) % 7)
      const sunday = day === 0 ? today : addDays(saturday, 1)
      params.set('from', dateInputValue(saturday))
      params.set('to', dateInputValue(sunday))
    }

    applyFilters(params)
  }

  const removeFilter = (key) => {
    const params = new URLSearchParams(queryString)
    params.delete(key)
    applyFilters(params)
  }

  const clearFilters = () => {
    applyFilters(new URLSearchParams())
  }

  const activeFilters = [
    initialParams.get('q') && ['q', `Search: ${initialParams.get('q')}`],
    initialParams.get('city') && ['city', `City: ${initialParams.get('city')}`],
    initialParams.get('from') && ['from', `From: ${initialParams.get('from')}`],
    initialParams.get('to') && ['to', `To: ${initialParams.get('to')}`],
  ].filter(Boolean)

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
          Find your next night out
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-[var(--text)] sm:text-5xl">
          Explore events
        </h1>
        <p className="mt-3 text-base leading-7 text-[var(--text-soft)]">
          Search the live event feed by keyword, city and date. Listings come directly from the EchoRoom events service.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_auto]">
          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text)]">
            Search
            <span className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3">
              <Search size={17} className="shrink-0 text-[var(--text-soft)]" aria-hidden="true" />
              <input
                type="search"
                value={filters.q}
                onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                placeholder="Event title, city or venue"
                className="min-w-0 flex-1 bg-transparent py-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-soft)]"
              />
            </span>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text)]">
            City
            <span className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3">
              <input
                type="search"
                list="echoroom-zimbabwe-cities"
                value={filters.city}
                onChange={(event) => setFilters((current) => ({ ...current, city: event.target.value }))}
                placeholder="e.g. Harare"
                className="min-w-0 flex-1 bg-transparent py-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-soft)]"
              />
              <datalist id="echoroom-zimbabwe-cities">
                {ZIMBABWE_CITIES.map((city) => <option key={city} value={city} />)}
              </datalist>
            </span>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text)]">
            From
            <input
              type="date"
              value={filters.from}
              onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text)]">
            To
            <input
              type="date"
              value={filters.to}
              onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
          </label>

          <button
            type="submit"
            className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            Apply filters
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold text-[var(--text-soft)]">Quick dates</span>
          {[
            ['today', 'Today'],
            ['tomorrow', 'Tomorrow'],
            ['weekend', 'This weekend'],
            ['upcoming', 'All upcoming'],
          ].map(([preset, label]) => (
            <button
              key={preset}
              type="button"
              onClick={() => setDatePreset(preset)}
              className="min-h-9 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              {label}
            </button>
          ))}
        </div>
        {filterError && (
          <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-300">
            {filterError}
          </p>
        )}
        <p className="mt-3 text-xs text-[var(--text-soft)]">
          Search matches event titles, venues and cities. Genre, ticket-price, artist and promoter filters aren’t available in the current events API.
        </p>
      </form>

      {activeFilters.length > 0 && (
        <section aria-label="Active filters" className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text)]">Active filters</span>
          {activeFilters.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => removeFilter(key)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text-soft)] hover:border-[var(--primary)] hover:text-[var(--text)]"
              aria-label={`Remove ${label} filter`}
            >
              {label}
              <X size={13} aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-9 px-2 text-xs font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        </section>
      )}

      <section aria-labelledby="results-heading" aria-busy={loading}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 id="results-heading" className="text-xl font-bold text-[var(--text)]">
              {queryString ? 'Search results' : 'Upcoming events'}
            </h2>
            {!loading && !errorMessage && (
              <p className="mt-1 text-sm text-[var(--text-soft)]">
                {events.length} {events.length === 1 ? 'event' : 'events'} found
              </p>
            )}
          </div>
        </div>

        {loading && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => <EventCardSkeleton key={index} />)}
          </div>
        )}

        {!loading && errorMessage && (
          <div role="alert" className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-7 text-center">
            <p className="font-semibold text-[var(--text)]">Events couldn’t be loaded</p>
            <p className="mt-2 text-sm text-[var(--text-soft)]">{errorMessage}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:border-[var(--primary)]"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !errorMessage && events.length === 0 && (
          <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
            <CalendarDays size={25} className="mx-auto text-[var(--primary)]" aria-hidden="true" />
            <h3 className="mt-4 font-semibold text-[var(--text)]">No matching events yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-soft)]">
              Try another keyword, city or date range. Only events returned by the live events service are shown.
            </p>
          </div>
        )}

        {!loading && !errorMessage && events.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        )}
      </section>
    </div>
  )
}
