import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Disc3,
  MapPin,
  Music2,
  Radio,
  Search,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import EventCard from '../../components/events/EventCard'
import { getEvents } from '../../services/events.service'
import { getPromoters } from '../../services/promoters.service'
import { getApiErrorMessage } from '../../utils/apiError'

const benefits = [
  {
    icon: Radio,
    title: 'Find your scene',
    description: 'Explore music events and local nights from one place.',
  },
  {
    icon: UsersRound,
    title: 'Meet the people behind it',
    description: 'Follow promoters and stay close to the communities you love.',
  },
  {
    icon: Sparkles,
    title: 'Less scrolling, more dancing',
    description: 'Spend less time hunting for details and more time making plans.',
  },
]

export default function HomePage() {
  const navigate = useNavigate()
  const [location, setLocation] = useState('')
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState('')
  const [promoters, setPromoters] = useState([])
  const [promotersLoading, setPromotersLoading] = useState(true)
  const [promotersError, setPromotersError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    getEvents({}, controller.signal)
      .then((events) => setUpcomingEvents(events.slice(0, 3)))
      .catch((error) => {
        if (error.name !== 'CanceledError') {
          setEventsError(getApiErrorMessage(error, 'Upcoming events could not be loaded.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setEventsLoading(false)
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    getPromoters(controller.signal)
      .then((profiles) => setPromoters(profiles.slice(0, 3)))
      .catch((error) => {
        if (error.name !== 'CanceledError') {
          setPromotersError(getApiErrorMessage(error, 'Promoter profiles could not be loaded.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPromotersLoading(false)
      })

    return () => controller.abort()
  }, [])

  const handleSearch = (event) => {
    event.preventDefault()
    const city = location.trim()
    navigate(city ? `/events?city=${encodeURIComponent(city)}` : '/events')
  }

  return (
    <div className="space-y-20 pb-8 sm:space-y-28">
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] px-6 py-10 shadow-[var(--shadow)] sm:px-10 sm:py-14 lg:min-h-[590px] lg:px-16 lg:py-16">
        <div
          aria-hidden="true"
          className="absolute -right-36 -top-32 -z-10 h-[34rem] w-[34rem] rounded-full bg-violet-500/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-48 left-1/4 -z-10 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl"
        />

        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="relative z-10"
          >
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
              Zimbabwe, find your rhythm
            </div>

            <h1 className="max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.075em] text-[var(--text)] sm:text-6xl lg:text-7xl">
              Your city has
              <span className="block text-[var(--primary)]">a soundtrack.</span>
              Find your place in it.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[var(--text-soft)] sm:text-lg">
              EchoRoom brings music fans, promoters and venues closer together.
              Discover the scene, follow the people shaping it, and make your
              next night out count.
            </p>

            <form
              onSubmit={handleSearch}
              className="mt-8 flex max-w-xl flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-lg shadow-violet-950/5 sm:flex-row sm:items-center"
            >
              <label className="flex min-w-0 flex-1 items-center gap-3 px-2">
                <MapPin size={19} className="shrink-0 text-[var(--primary)]" aria-hidden="true" />
                <span className="sr-only">Search events by city or location</span>
                <input
                  type="search"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Where do you want to go?"
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-soft)]"
                />
              </label>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                <Search size={16} aria-hidden="true" />
                Find events
              </button>
            </form>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--text-soft)]">
              <span className="inline-flex items-center gap-2">
                <Check size={15} className="text-[var(--primary)]" aria-hidden="true" />
                A home for Zimbabwean music
              </span>
              <a
                href="/events"
                className="inline-flex items-center gap-1 font-medium text-[var(--text)] transition hover:text-[var(--primary)]"
              >
                See what’s coming
                <ArrowDown size={14} aria-hidden="true" />
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.12, ease: 'easeOut' }}
            className="relative mx-auto flex aspect-square w-full max-w-[440px] items-center justify-center"
            aria-label="Abstract EchoRoom music illustration"
            role="img"
          >
            <div className="absolute inset-[8%] rounded-full border border-[var(--border)]" />
            <div className="absolute inset-[17%] rounded-full border border-dashed border-[var(--border)]" />
            <div className="absolute inset-[27%] rounded-full bg-[radial-gradient(circle,_rgba(139,92,246,0.28),_rgba(139,92,246,0.04)_68%,_transparent_70%)]" />

            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 36, repeat: Infinity, ease: 'linear' }}
              className="relative flex aspect-square w-[58%] items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle_at_35%_30%,_#4c1d95,_#171126_60%,_#090b15)] shadow-2xl shadow-violet-950/40"
            >
              <div className="absolute inset-[11%] rounded-full border border-white/10" />
              <div className="absolute inset-[24%] rounded-full border border-white/10" />
              <div className="absolute inset-[39%] rounded-full border border-white/10" />
              <div className="z-10 flex h-[23%] w-[23%] items-center justify-center rounded-full bg-violet-300 text-violet-950 shadow-lg shadow-violet-300/30">
                <Music2 size={26} strokeWidth={2.2} />
              </div>
            </motion.div>

            <div className="absolute right-[2%] top-[16%] rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-3 shadow-xl backdrop-blur">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-[var(--primary)]">
                  <Disc3 size={17} />
                </span>
                <div>
                  <p className="text-xs font-semibold text-[var(--text)]">The local scene</p>
                  <p className="text-[10px] text-[var(--text-soft)]">All in one room</p>
                </div>
              </div>
            </div>

            <div className="absolute bottom-[14%] left-[0%] rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-3 shadow-xl backdrop-blur">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-500">
                  <CalendarDays size={17} />
                </span>
                <div>
                  <p className="text-xs font-semibold text-[var(--text)]">Your next night out</p>
                  <p className="text-[10px] text-[var(--text-soft)]">Starts with a discovery</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section aria-labelledby="benefits-heading" className="space-y-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            A scene worth finding
          </p>
          <h2
            id="benefits-heading"
            className="mt-3 text-3xl font-bold tracking-[-0.055em] text-[var(--text)] sm:text-4xl"
          >
            Everything that brings a night to life.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {benefits.map(({ icon: Icon, title, description }, index) => (
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: index * 0.08 }}
              className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 transition hover:-translate-y-1 hover:shadow-[var(--shadow)]"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 text-[var(--primary)]">
                <Icon size={20} aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text)]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{description}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section id="featured-events" aria-labelledby="featured-heading" className="scroll-mt-28">
        <div className="flex flex-col justify-between gap-5 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Handpicked for you
            </p>
            <h2
              id="featured-heading"
              className="mt-3 text-3xl font-bold tracking-[-0.055em] text-[var(--text)] sm:text-4xl"
            >
              Featured events
            </h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Standout nights from across the local music scene.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center sm:px-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-[var(--primary)]">
            <CalendarDays size={24} aria-hidden="true" />
          </div>
          <h3 className="mt-5 text-lg font-semibold text-[var(--text)]">Featured picks aren’t available yet.</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--text-soft)]">
            The current events API doesn’t identify featured events. Upcoming
            listings are shown below without presenting them as editorial picks.
          </p>
        </div>
      </section>

      <section id="events" aria-labelledby="events-heading" className="scroll-mt-28">
        <div className="flex flex-col justify-between gap-5 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Make a plan
            </p>
            <h2
              id="events-heading"
              className="mt-3 text-3xl font-bold tracking-[-0.055em] text-[var(--text)] sm:text-4xl"
            >
              Upcoming events
            </h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Find a reason to get out and hear something great.
            </p>
          </div>
          <a
            href="/events"
            className="inline-flex items-center gap-2 self-start text-sm font-semibold text-[var(--primary)] transition hover:text-[var(--primary-strong)] sm:self-auto"
          >
            Browse all events
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>

        {eventsLoading && (
          <div aria-label="Loading upcoming events" className="mt-6 grid animate-pulse gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-64 rounded-3xl bg-[var(--surface-strong)]" />
            ))}
          </div>
        )}
        {!eventsLoading && eventsError && (
          <p role="alert" className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 text-sm text-[var(--text-soft)]">
            {eventsError}
          </p>
        )}
        {!eventsLoading && !eventsError && upcomingEvents.length === 0 && (
          <div className="mt-6 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
            <CalendarDays size={24} className="mx-auto text-[var(--primary)]" aria-hidden="true" />
            <h3 className="mt-4 font-semibold text-[var(--text)]">No upcoming events are listed right now.</h3>
            <p className="mt-2 text-sm text-[var(--text-soft)]">Check back as promoters publish new events.</p>
          </div>
        )}
        {!eventsLoading && !eventsError && upcomingEvents.length > 0 && (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        )}
      </section>

      <section id="promoters" aria-labelledby="popular-promoters-heading" className="scroll-mt-28">
        <div className="border-b border-[var(--border)] pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Find your people
          </p>
          <h2
            id="popular-promoters-heading"
            className="mt-3 text-3xl font-bold tracking-[-0.055em] text-[var(--text)] sm:text-4xl"
          >
            Promoters to discover
          </h2>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Meet the local teams bringing music to life.
          </p>
        </div>
        <p className="mt-3 text-xs text-[var(--text-soft)]">Profiles are listed by newest first; popularity ranking isn’t provided by the current API.</p>
        {promotersLoading && (
          <div aria-label="Loading promoter profiles" className="mt-6 grid animate-pulse gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-36 rounded-3xl bg-[var(--surface-strong)]" />
            ))}
          </div>
        )}
        {!promotersLoading && promotersError && (
          <p role="alert" className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 text-sm text-[var(--text-soft)]">
            {promotersError}
          </p>
        )}
        {!promotersLoading && !promotersError && promoters.length === 0 && (
          <div className="mt-6 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center">
            <UsersRound size={22} className="mx-auto text-[var(--primary)]" aria-hidden="true" />
            <h3 className="mt-4 text-base font-semibold text-[var(--text)]">No promoter profiles are listed yet.</h3>
          </div>
        )}
        {!promotersLoading && !promotersError && promoters.length > 0 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {promoters.map((promoter) => (
              <article key={promoter.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10 text-[var(--primary)]">
                  <UsersRound size={18} aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-semibold text-[var(--text)]">{promoter.display_name}</h3>
                {promoter.city && <p className="mt-1 text-sm text-[var(--text-soft)]">{promoter.city}</p>}
                {promoter.bio && <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--text-soft)]">{promoter.bio}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        id="promoter-cta"
        aria-labelledby="promoters-heading"
        className="scroll-mt-28 overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]"
      >
        <div className="grid lg:grid-cols-[1fr_0.8fr]">
          <div className="p-7 sm:p-10 lg:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              For the people who make it happen
            </p>
            <h2
              id="promoters-heading"
              className="mt-4 max-w-xl text-3xl font-bold tracking-[-0.055em] text-[var(--text)] sm:text-4xl"
            >
              Bring your next event into the room.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--text-soft)] sm:text-base">
              Give fans one reliable place to find your events, follow your
              updates and connect with the nights you create.
            </p>
            <a
              href="/login"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Get started as a promoter
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>

          <div className="relative flex min-h-64 items-center justify-center overflow-hidden bg-[linear-gradient(145deg,_rgba(124,58,237,0.16),_rgba(236,72,153,0.09))] p-8">
            <div
              aria-hidden="true"
              className="absolute -right-10 -top-16 h-64 w-64 rounded-full border border-[var(--primary)]/20"
            />
            <div
              aria-hidden="true"
              className="absolute -right-2 -top-8 h-48 w-48 rounded-full border border-[var(--primary)]/20"
            />
            <div className="relative max-w-xs rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)] text-white">
                  <Music2 size={20} />
                </div>
                <div>
                  <p className="font-semibold text-[var(--text)]">Your community</p>
                  <p className="text-xs text-[var(--text-soft)]">Your events, all together</p>
                </div>
                <ChevronDown size={17} className="ml-auto rotate-[-90deg] text-[var(--text-soft)]" />
              </div>
              <div className="my-5 h-px bg-[var(--border)]" />
              <p className="text-sm leading-6 text-[var(--text-soft)]">
                Create a home for your events and the fans who follow them.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
