import { useEffect, useMemo, useState } from 'react'
import { format, isValid } from 'date-fns'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  EyeOff,
  History,
  ShieldCheck,
  UsersRound,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  dismissReport,
  getAdminEvents,
  getAdminReports,
  getAdminUsers,
  getEventModerationLog,
  reviewReport,
  verifyAdminEvent,
} from '../../services/admin.service'
import { getApiErrorMessage } from '../../utils/apiError'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'events', label: 'Events' },
  { id: 'reports', label: 'Reports' },
]

const REVIEW_DECISIONS = [
  { value: 'hide', label: 'Hide event' },
  { value: 'unhide', label: 'Unhide event' },
  { value: 'verify', label: 'Verify event' },
  { value: 'unverify', label: 'Remove verification' },
]

function formatDate(value) {
  const date = new Date(value)
  return isValid(date) ? format(date, 'MMM d, yyyy · h:mm a') : 'Date unavailable'
}

function Metric({ label, value, icon: Icon, tone = 'violet' }) {
  const iconTone = tone === 'amber'
    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300'
    : tone === 'rose'
      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300'
      : 'bg-violet-500/10 text-[var(--primary)]'

  return (
    <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--text-soft)]">{label}</p>
          <p className="mt-4 text-3xl font-black tracking-[-0.06em] text-[var(--text)]">
            {value === null ? '—' : value.toLocaleString()}
          </p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconTone}`}>
          <Icon size={19} aria-hidden="true" />
        </span>
      </div>
    </article>
  )
}

function StatusBadge({ children, tone = 'neutral' }) {
  const classes = {
    neutral: 'bg-[var(--surface-strong)] text-[var(--text-soft)]',
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    danger: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  }

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${classes[tone]}`}>
      {children}
    </span>
  )
}

function ReviewDialog({ report, saving, error, onSubmit, onDismiss, onClose }) {
  const [decision, setDecision] = useState('hide')
  const [publicNote, setPublicNote] = useState('')
  const [privateNote, setPrivateNote] = useState('')
  const [dismissNote, setDismissNote] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-report-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">Report review</p>
            <h2 id="review-report-title" className="mt-2 text-xl font-bold text-[var(--text)]">
              {report.event_title}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close review dialog" className="rounded-full border border-[var(--border)] p-2 text-[var(--text-soft)] hover:text-[var(--text)]">
            <X size={17} />
          </button>
        </div>

        <div className="mt-5 rounded-2xl bg-[var(--surface-strong)] p-4 text-sm">
          <p className="font-semibold text-[var(--text)]">{report.reason}</p>
          {report.description && <p className="mt-2 whitespace-pre-wrap leading-6 text-[var(--text-soft)]">{report.description}</p>}
          <p className="mt-3 text-xs text-[var(--text-soft)]">Reported {formatDate(report.created_at)}</p>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-[var(--text)]">
            {error}
          </p>
        )}

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(decision, { publicNote, privateNote })
          }}
        >
          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text)]">
            Moderation decision
            <select
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
            >
              {REVIEW_DECISIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text)]">
            Public note <span className="font-normal text-[var(--text-soft)]">Optional · visible in the decision record</span>
            <textarea
              value={publicNote}
              onChange={(event) => setPublicNote(event.target.value)}
              maxLength={1000}
              className="min-h-20 resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text)]">
            Private note <span className="font-normal text-[var(--text-soft)]">Optional · admin-only record</span>
            <textarea
              value={privateNote}
              onChange={(event) => setPrivateNote(event.target.value)}
              maxLength={4000}
              className="min-h-20 resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
          </label>

          <div className="flex flex-col-reverse justify-between gap-3 border-t border-[var(--border)] pt-4 sm:flex-row">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => onDismiss(dismissNote)}
                className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] hover:border-[var(--primary)] disabled:opacity-60"
              >
                Dismiss report
              </button>
              <input
                aria-label="Dismissal note"
                value={dismissNote}
                onChange={(event) => setDismissNote(event.target.value)}
                maxLength={2000}
                placeholder="Dismissal note"
                className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5 text-sm text-[var(--text)] sm:max-w-44"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--text)]"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--primary-strong)] disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Record decision'}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}

function ModerationHistoryDialog({ event, entries, loading, error, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="moderation-history-title"
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">Moderation history</p>
            <h2 id="moderation-history-title" className="mt-2 text-xl font-bold text-[var(--text)]">{event.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close moderation history" className="rounded-full border border-[var(--border)] p-2 text-[var(--text-soft)] hover:text-[var(--text)]">
            <X size={17} />
          </button>
        </div>

        {loading && <p role="status" className="mt-6 text-sm text-[var(--text-soft)]">Loading moderation history…</p>}
        {error && <p role="alert" className="mt-6 text-sm text-rose-600 dark:text-rose-300">{error}</p>}
        {!loading && !error && entries.length === 0 && (
          <p className="mt-6 rounded-2xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-soft)]">
            No moderation decisions are recorded for this event.
          </p>
        )}
        {!loading && !error && entries.length > 0 && (
          <ol className="mt-6 space-y-4">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge tone={entry.decision === 'hide' ? 'danger' : 'success'}>{entry.decision}</StatusBadge>
                  <time className="text-xs text-[var(--text-soft)]">{formatDate(entry.created_at)}</time>
                </div>
                {entry.public_note && <p className="mt-3 text-sm text-[var(--text)]">Public: {entry.public_note}</p>}
                {entry.private_note && <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-soft)]">Private: {entry.private_note}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

export default function AdminDashboardPage() {
  const [retryCount, setRetryCount] = useState(0)
  const [tab, setTab] = useState('overview')
  const [users, setUsers] = useState(null)
  const [events, setEvents] = useState(null)
  const [reports, setReports] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [eventFilter, setEventFilter] = useState('all')
  const [reportStatusFilter, setReportStatusFilter] = useState('open')
  const [reviewTarget, setReviewTarget] = useState(null)
  const [savingReview, setSavingReview] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [historyTarget, setHistoryTarget] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [eventActionError, setEventActionError] = useState('')
  const [eventActionPending, setEventActionPending] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    Promise.allSettled([
      getAdminUsers(controller.signal),
      getAdminEvents(controller.signal),
      getAdminReports(reportStatusFilter, controller.signal),
    ]).then(([usersResult, eventsResult, reportsResult]) => {
      if (controller.signal.aborted) return

      const failures = []
      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value)
      } else {
        setUsers(null)
        failures.push(`Users: ${getApiErrorMessage(usersResult.reason, 'unavailable')}`)
      }
      if (eventsResult.status === 'fulfilled') {
        setEvents(eventsResult.value)
      } else {
        setEvents(null)
        failures.push(`Events: ${getApiErrorMessage(eventsResult.reason, 'unavailable')}`)
      }
      if (reportsResult.status === 'fulfilled') {
        setReports(reportsResult.value)
      } else {
        setReports(null)
        failures.push(`Reports: ${getApiErrorMessage(reportsResult.reason, 'unavailable')}`)
      }

      setLoadError(failures.join(' '))
      setLoading(false)
    })

    return () => controller.abort()
  }, [retryCount, reportStatusFilter])

  const visibleEvents = useMemo(() => {
    if (!events) return []
    if (eventFilter === 'all') return events
    if (eventFilter === 'hidden') return events.filter((event) => event.is_hidden)
    if (eventFilter === 'verified') return events.filter((event) => event.label === 'verified')
    return events.filter((event) => event.status === eventFilter)
  }, [eventFilter, events])

  const retryLoad = () => {
    setLoading(true)
    setLoadError('')
    setRetryCount((current) => current + 1)
  }

  const handleReview = async (decision, notes) => {
    if (!reviewTarget) return
    setSavingReview(true)
    setReviewError('')

    try {
      await reviewReport(reviewTarget.id, decision, notes)
      setReviewTarget(null)
      retryLoad()
    } catch (error) {
      setReviewError(getApiErrorMessage(error, 'Could not record this moderation decision.'))
    } finally {
      setSavingReview(false)
    }
  }

  const handleDismiss = async (note) => {
    if (!reviewTarget) return
    setSavingReview(true)
    setReviewError('')

    try {
      await dismissReport(reviewTarget.id, note.trim())
      setReviewTarget(null)
      retryLoad()
    } catch (error) {
      setReviewError(getApiErrorMessage(error, 'Could not dismiss this report.'))
    } finally {
      setSavingReview(false)
    }
  }

  const handleVerify = async (event) => {
    const shouldVerify = event.label !== 'verified'
    setEventActionPending(String(event.id))
    setEventActionError('')

    try {
      await verifyAdminEvent(event.id, shouldVerify)
      setEvents((current) => current.map((item) => (
        String(item.id) === String(event.id)
          ? {
              ...item,
              label: shouldVerify ? 'verified' : 'posted_by_promoter',
            }
          : item
      )))
    } catch (error) {
      setEventActionError(getApiErrorMessage(error, 'Could not update event verification.'))
    } finally {
      setEventActionPending('')
    }
  }

  const openHistory = async (event) => {
    setHistoryTarget(event)
    setHistory([])
    setHistoryError('')
    setHistoryLoading(true)

    try {
      setHistory(await getEventModerationLog(event.id))
    } catch (error) {
      setHistoryError(getApiErrorMessage(error, 'Could not load moderation history.'))
    } finally {
      setHistoryLoading(false)
    }
  }

  const openReports = reports?.filter((report) => report.status === 'open') || []
  const openReportsCount = reports === null ? null : openReports.length
  const hiddenCount = events === null ? null : events.filter((event) => event.is_hidden).length
  const verifiedCount = events === null ? null : events.filter((event) => event.label === 'verified').length

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Administration</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[var(--text)]">Platform overview</h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">Review platform data and moderation activity.</p>
        </div>
        <button
          type="button"
          onClick={retryLoad}
          disabled={loading}
          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:border-[var(--primary)] disabled:opacity-60"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {loadError && (
        <div role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-6 text-[var(--text-soft)]">
          Some admin data could not be loaded: {loadError}
          <button type="button" onClick={retryLoad} className="ml-3 font-semibold text-[var(--primary)] underline underline-offset-2">
            Retry
          </button>
        </div>
      )}
      {eventActionError && (
        <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-[var(--text)]">
          {eventActionError}
        </p>
      )}

      <nav aria-label="Admin sections" className="flex gap-2 overflow-x-auto border-b border-[var(--border)]">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              tab === id ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--text-soft)] hover:text-[var(--text)]'
            }`}
          >
            {label}
            {id === 'reports' && openReportsCount > 0 && (
              <span className="ml-2 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs text-rose-600 dark:text-rose-300">
                {openReportsCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {loading && (
        <div role="status" className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-soft)]">
          Loading admin data…
        </div>
      )}

      {!loading && tab === 'overview' && (
        <section className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Users" value={users?.length ?? null} icon={UsersRound} />
            <Metric label="Events" value={events?.length ?? null} icon={Clock3} />
            <Metric label="Open reports" value={openReportsCount} icon={AlertTriangle} tone="amber" />
            <Metric label="Hidden events" value={hiddenCount} icon={EyeOff} tone="rose" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text)]">Reports needing review</h2>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">Open reports from the moderation queue.</p>
                </div>
                <AlertTriangle size={20} className="text-amber-500" aria-hidden="true" />
              </div>
              {reports === null ? (
                <p role="alert" className="mt-5 rounded-2xl bg-[var(--surface-strong)] p-4 text-sm text-[var(--text-soft)]">
                  Open reports are unavailable because the reports service could not be loaded.
                </p>
              ) : openReports.length === 0 ? (
                <p className="mt-5 rounded-2xl bg-[var(--surface-strong)] p-4 text-sm text-[var(--text-soft)]">
                  No open reports.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-[var(--border)]">
                  {openReports.slice(0, 4).map((report) => (
                    <li key={report.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--text)]">{report.event_title}</p>
                        <p className="mt-1 truncate text-sm text-[var(--text-soft)]">{report.reason}</p>
                      </div>
                      <button type="button" onClick={() => setReviewTarget(report)} className="shrink-0 text-sm font-semibold text-[var(--primary)]">
                        Review
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text)]">Event verification</h2>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">Verification labels from the events service.</p>
                </div>
                <ShieldCheck size={20} className="text-[var(--primary)]" aria-hidden="true" />
              </div>
              <p className="mt-5 text-3xl font-black tracking-[-0.06em] text-[var(--text)]">
                {verifiedCount === null ? '—' : verifiedCount}
              </p>
              <p className="text-sm text-[var(--text-soft)]">
                {verifiedCount === null ? 'Verification count unavailable' : 'verified events'}
              </p>
              <button type="button" onClick={() => setTab('events')} className="mt-5 text-sm font-semibold text-[var(--primary)]">
                Manage events →
              </button>
            </section>
          </div>
        </section>
      )}

      {!loading && tab === 'users' && (
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-[var(--text)]">Users</h2>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              Read-only user directory. The current backend provides no user update or deletion endpoints.
            </p>
          </div>
          {users === null ? (
            <p role="alert" className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-8 text-center text-sm text-[var(--text-soft)]">
              User data is unavailable. Use Refresh to try again.
            </p>
          ) : users.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-soft)]">
              No users are available.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                <thead className="bg-[var(--surface-strong)] text-xs uppercase tracking-wide text-[var(--text-soft)]">
                  <tr>
                    <th scope="col" className="px-5 py-4 font-semibold">Name</th>
                    <th scope="col" className="px-5 py-4 font-semibold">Email</th>
                    <th scope="col" className="px-5 py-4 font-semibold">Role</th>
                    <th scope="col" className="px-5 py-4 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-5 py-4 font-medium text-[var(--text)]">{user.full_name}</td>
                      <td className="px-5 py-4 text-[var(--text-soft)]">{user.email}</td>
                      <td className="px-5 py-4"><StatusBadge>{user.role}</StatusBadge></td>
                      <td className="px-5 py-4 text-[var(--text-soft)]">{formatDate(user.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {!loading && tab === 'events' && (
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[var(--text)]">Events</h2>
              <p className="mt-1 text-sm text-[var(--text-soft)]">All event statuses from the admin events endpoint.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
              Filter
              <select
                value={eventFilter}
                onChange={(event) => setEventFilter(event.target.value)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              >
                <option value="all">All events</option>
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
                <option value="archived">Archived</option>
                <option value="verified">Verified</option>
                <option value="hidden">Hidden</option>
              </select>
            </label>
          </div>

          {events === null ? (
            <p role="alert" className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-8 text-center text-sm text-[var(--text-soft)]">
              Event data is unavailable. Use Refresh to try again.
            </p>
          ) : visibleEvents.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-soft)]">
              No events match this filter.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full min-w-[850px] border-collapse text-left text-sm">
                <thead className="bg-[var(--surface-strong)] text-xs uppercase tracking-wide text-[var(--text-soft)]">
                  <tr>
                    <th scope="col" className="px-5 py-4 font-semibold">Event</th>
                    <th scope="col" className="px-5 py-4 font-semibold">Status</th>
                    <th scope="col" className="px-5 py-4 font-semibold">Moderation</th>
                    <th scope="col" className="px-5 py-4 font-semibold">Date</th>
                    <th scope="col" className="px-5 py-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {visibleEvents.map((event) => (
                    <tr key={event.id}>
                      <td className="max-w-72 px-5 py-4">
                        <Link to={`/events/${encodeURIComponent(event.id)}`} className="font-semibold text-[var(--text)] hover:text-[var(--primary)]">
                          {event.title}
                        </Link>
                        <p className="mt-1 truncate text-xs text-[var(--text-soft)]">{[event.venue, event.city].filter(Boolean).join(', ')}</p>
                      </td>
                      <td className="px-5 py-4"><StatusBadge tone={event.status === 'active' ? 'success' : event.status === 'cancelled' ? 'danger' : 'neutral'}>{event.status}</StatusBadge></td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge tone={event.label === 'verified' ? 'success' : 'neutral'}>{event.label?.replaceAll('_', ' ') || 'unlabelled'}</StatusBadge>
                          {event.is_hidden && <StatusBadge tone="danger">hidden</StatusBadge>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-[var(--text-soft)]">{formatDate(event.start_at)}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleVerify(event)}
                            disabled={eventActionPending === String(event.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] hover:border-[var(--primary)] disabled:opacity-60"
                          >
                            {event.label === 'verified' ? <EyeOff size={13} /> : <CheckCircle2 size={13} />}
                            {eventActionPending === String(event.id) ? 'Saving…' : event.label === 'verified' ? 'Unverify' : 'Verify'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openHistory(event)}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] hover:border-[var(--primary)]"
                          >
                            <History size={13} />
                            History
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-[var(--text-soft)]">
            Hide/unhide controls are available when reviewing a report. The backend has no standalone hide-event endpoint.
          </p>
        </section>
      )}

      {!loading && tab === 'reports' && (
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[var(--text)]">Reported events</h2>
              <p className="mt-1 text-sm text-[var(--text-soft)]">Review a report with a moderation decision or dismiss it.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
              Status
              <select
                value={reportStatusFilter}
                onChange={(event) => {
                  setLoading(true)
                  setReportStatusFilter(event.target.value)
                }}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              >
                <option value="open">Open</option>
                <option value="reviewed">Reviewed</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </label>
          </div>

          {reports === null ? (
            <p role="alert" className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-8 text-center text-sm text-[var(--text-soft)]">
              Report data is unavailable. Use Refresh to try again.
            </p>
          ) : reports.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-soft)]">
              No {reportStatusFilter} reports.
            </p>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <article key={report.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-[var(--text)]">{report.event_title}</h3>
                        <StatusBadge tone={report.status === 'open' ? 'warning' : 'neutral'}>{report.status}</StatusBadge>
                      </div>
                      <p className="mt-2 font-medium text-[var(--text-soft)]">{report.reason}</p>
                      {report.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-soft)]">{report.description}</p>}
                      <p className="mt-3 text-xs text-[var(--text-soft)]">Reported {formatDate(report.created_at)}</p>
                    </div>
                    {report.status === 'open' && (
                      <button
                        type="button"
                        onClick={() => {
                          setReviewError('')
                          setReviewTarget(report)
                        }}
                        className="shrink-0 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-strong)]"
                      >
                        Review report
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {reviewTarget && (
        <ReviewDialog
          report={reviewTarget}
          saving={savingReview}
          error={reviewError}
          onSubmit={handleReview}
          onDismiss={handleDismiss}
          onClose={() => {
            if (!savingReview) setReviewTarget(null)
          }}
        />
      )}

      {historyTarget && (
        <ModerationHistoryDialog
          event={historyTarget}
          entries={history}
          loading={historyLoading}
          error={historyError}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  )
}
