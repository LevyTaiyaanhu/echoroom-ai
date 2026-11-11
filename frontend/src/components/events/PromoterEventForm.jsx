import { useState } from 'react'
import { AlertTriangle, FileImage, Sparkles, Upload, X } from 'lucide-react'
import { extractFlyer, findPossibleDuplicates, generateEventDescription } from '../../services/ai.service'
import { getApiErrorMessage } from '../../utils/apiError'

const MAX_FLYER_SIZE = 5 * 1024 * 1024
const ALLOWED_FLYER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function toLocalDateTime(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function makeInitialValues(event) {
  return {
    title: event?.title || '',
    artists: Array.isArray(event?.artists) ? event.artists.join(', ') : '',
    venue: event?.venue || '',
    city: event?.city || '',
    start_at: toLocalDateTime(event?.start_at),
    end_at: toLocalDateTime(event?.end_at),
    host: event?.host || '',
    description: event?.description || '',
    ticket_price_info: event?.ticket_price_info || '',
    booking_info: event?.booking_info || '',
  }
}

export default function PromoterEventForm({ event, saving, error, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => makeInitialValues(event))
  const [validationError, setValidationError] = useState('')
  const [flyerFile, setFlyerFile] = useState(null)
  const [flyerError, setFlyerError] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [extractionNote, setExtractionNote] = useState('')
  const [duplicateState, setDuplicateState] = useState(null)
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const [descriptionState, setDescriptionState] = useState('')
  const [generatingDescription, setGeneratingDescription] = useState(false)

  const updateFields = (updates) => {
    setValues((current) => ({ ...current, ...updates }))
    setValidationError('')
    setDuplicateState(null)
  }

  const updateField = (field, value) => {
    updateFields({ [field]: value })
  }

  const handleFlyerSelection = (event) => {
    const file = event.target.files?.[0] || null
    setFlyerError('')
    setExtractionNote('')
    setDuplicateState(null)

    if (!file) {
      setFlyerFile(null)
      return
    }

    if (!ALLOWED_FLYER_TYPES.has(file.type)) {
      setFlyerFile(null)
      setFlyerError('Choose a JPEG, PNG, WEBP, or GIF image.')
      event.target.value = ''
      return
    }

    if (file.size > MAX_FLYER_SIZE) {
      setFlyerFile(null)
      setFlyerError('The flyer must be 5 MB or smaller.')
      event.target.value = ''
      return
    }

    setFlyerFile(file)
  }

  const handleExtractFlyer = async () => {
    if (!flyerFile) {
      setFlyerError('Choose a flyer image before starting extraction.')
      return
    }

    setExtracting(true)
    setFlyerError('')
    setExtractionNote('')
    setUploadProgress(0)

    try {
      const { extracted, note } = await extractFlyer(flyerFile, setUploadProgress)
      const updates = {}

      if (typeof extracted.title === 'string') updates.title = extracted.title
      if (Array.isArray(extracted.artists)) {
        updates.artists = extracted.artists.filter((artist) => typeof artist === 'string').join(', ')
      } else if (typeof extracted.artists === 'string') {
        updates.artists = extracted.artists
      }
      if (typeof extracted.venue === 'string') updates.venue = extracted.venue
      if (typeof extracted.city === 'string') updates.city = extracted.city
      if (typeof extracted.host === 'string') updates.host = extracted.host
      if (typeof extracted.ticket_price === 'string') updates.ticket_price_info = extracted.ticket_price
      if (typeof extracted.booking_info === 'string') updates.booking_info = extracted.booking_info

      if (
        typeof extracted.event_date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(extracted.event_date) &&
        typeof extracted.event_time === 'string' &&
        /^\d{2}:\d{2}$/.test(extracted.event_time)
      ) {
        updates.start_at = `${extracted.event_date}T${extracted.event_time}`
      }

      updateFields(updates)
      setExtractionNote(note || 'Review each extracted field and correct anything that is inaccurate.')
    } catch (requestError) {
      setFlyerError(getApiErrorMessage(requestError, 'Could not process the flyer. Please try again.'))
    } finally {
      setExtracting(false)
    }
  }

  const handleDuplicateCheck = async () => {
    if (!values.title.trim()) {
      setDuplicateState({ error: 'Add an event title before checking for possible duplicates.' })
      return
    }

    setCheckingDuplicates(true)
    setDuplicateState(null)

    try {
      const start = values.start_at ? new Date(values.start_at) : null
      const { duplicates, message } = await findPossibleDuplicates({
        title: values.title.trim(),
        ...(values.artists.trim() && {
          artists: values.artists.split(',').map((artist) => artist.trim()).filter(Boolean),
        }),
        ...(values.venue.trim() && { venue: values.venue.trim() }),
        ...(values.city.trim() && { city: values.city.trim() }),
        ...(start && !Number.isNaN(start.getTime()) && {
          event_date: start.toISOString().slice(0, 10),
          event_time: start.toISOString().slice(11, 16),
        }),
      })
      setDuplicateState({ duplicates, message })
    } catch (requestError) {
      setDuplicateState({
        error: getApiErrorMessage(requestError, 'Could not check for possible duplicates. Please try again.'),
      })
    } finally {
      setCheckingDuplicates(false)
    }
  }

  const handleGenerateDescription = async () => {
    if (!values.title.trim()) {
      setDescriptionState('Add an event title before generating a description.')
      return
    }

    setGeneratingDescription(true)
    setDescriptionState('')

    try {
      const start = values.start_at ? new Date(values.start_at) : null
      const { description, note } = await generateEventDescription({
        title: values.title.trim(),
        ...(values.artists.trim() && {
          artists: values.artists.split(',').map((artist) => artist.trim()).filter(Boolean),
        }),
        ...(values.venue.trim() && { venue: values.venue.trim() }),
        ...(values.city.trim() && { city: values.city.trim() }),
        ...(start && !Number.isNaN(start.getTime()) && {
          event_date: start.toISOString().slice(0, 10),
          event_time: start.toISOString().slice(11, 16),
        }),
        ...(values.host.trim() && { host: values.host.trim() }),
        ...(values.ticket_price_info.trim() && { ticket_price: values.ticket_price_info.trim() }),
        ...(values.booking_info.trim() && { booking_info: values.booking_info.trim() }),
        ...(values.description.trim() && { description: values.description.trim() }),
      })
      updateFields({ description })
      setDescriptionState(note || 'Generated text is a draft. Review and edit before creating the event.')
    } catch (requestError) {
      setDescriptionState(getApiErrorMessage(requestError, 'Could not generate a description. Please try again.'))
    } finally {
      setGeneratingDescription(false)
    }
  }

  const handleSubmit = (submitEvent) => {
    submitEvent.preventDefault()
    const artists = values.artists.split(',').map((artist) => artist.trim()).filter(Boolean)
    const startDate = new Date(values.start_at)
    const endDate = new Date(values.end_at)

    if (artists.length === 0) {
      setValidationError('Add at least one artist.')
      return
    }

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setValidationError('Enter valid event start and end dates.')
      return
    }

    if (endDate <= startDate) {
      setValidationError('The event end time must be after its start time.')
      return
    }

    onSubmit({
      ...values,
      artists,
      start_at: startDate.toISOString(),
      end_at: endDate.toISOString(),
      host: values.host.trim() || null,
      description: values.description.trim() || null,
      ticket_price_info: values.ticket_price_info.trim() || null,
      booking_info: values.booking_info.trim() || null,
    })
  }

  const inputClass =
    'w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)]'
  const labelClass = 'flex flex-col gap-2 text-sm font-medium text-[var(--text)]'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-form-title"
        className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl sm:rounded-3xl sm:p-7"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
              Event manager
            </p>
            <h2 id="event-form-title" className="mt-2 text-2xl font-bold text-[var(--text)]">
              {event ? 'Edit event' : 'Create an event'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close event form"
            className="rounded-full border border-[var(--border)] p-2 text-[var(--text-soft)] transition hover:text-[var(--text)]"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {(error || validationError) && (
            <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-[var(--text)]">
              {validationError || error}
            </p>
          )}

          <section aria-labelledby="flyer-processing-heading" className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-[var(--primary)]">
                <FileImage size={19} aria-hidden="true" />
              </span>
              <div>
                <h3 id="flyer-processing-heading" className="font-semibold text-[var(--text)]">AI flyer assistant</h3>
                <p className="mt-1 text-sm leading-5 text-[var(--text-soft)]">
                  Extract event details for you to review. Nothing is published automatically.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] hover:border-[var(--primary)]">
                <Upload size={16} className="shrink-0 text-[var(--primary)]" aria-hidden="true" />
                <span className="truncate">{flyerFile?.name || 'Choose a flyer image'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFlyerSelection}
                  className="sr-only"
                />
              </label>
              <button
                type="button"
                onClick={handleExtractFlyer}
                disabled={!flyerFile || extracting}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles size={16} aria-hidden="true" />
                {extracting ? 'Processing…' : 'Extract details'}
              </button>
            </div>

            {flyerFile && (
              <p className="mt-2 text-xs text-[var(--text-soft)]">
                {(flyerFile.size / (1024 * 1024)).toFixed(2)} MB · JPEG, PNG, WEBP or GIF · up to 5 MB
              </p>
            )}
            {extracting && (
              <div className="mt-4" role="status" aria-live="polite">
                <div className="mb-1 flex justify-between text-xs text-[var(--text-soft)]">
                  <span>{uploadProgress < 100 ? 'Uploading flyer…' : 'Analyzing flyer…'}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)] transition-[width]"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
            {flyerError && <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-300">{flyerError}</p>}
            {extractionNote && (
              <p role="status" className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm leading-5 text-[var(--text-soft)]">
                {extractionNote} Please verify all extracted fields against the original flyer.
              </p>
            )}
            <p className="mt-3 inline-flex items-start gap-2 text-xs leading-5 text-[var(--text-soft)]">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
              Source flyer images aren’t attached to created events; the current event API stores event details only.
            </p>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={`${labelClass} sm:col-span-2`}>
              Event title *
              <input
                className={inputClass}
                value={values.title}
                onChange={(event) => updateField('title', event.target.value)}
                maxLength={200}
                required
              />
            </label>

            <label className={`${labelClass} sm:col-span-2`}>
              Artists * <span className="font-normal text-[var(--text-soft)]">Separate multiple artists with commas.</span>
              <input
                className={inputClass}
                value={values.artists}
                onChange={(event) => updateField('artists', event.target.value)}
                required
              />
            </label>

            <label className={labelClass}>
              Venue *
              <input
                className={inputClass}
                value={values.venue}
                onChange={(event) => updateField('venue', event.target.value)}
                maxLength={200}
                required
              />
            </label>

            <label className={labelClass}>
              City *
              <input
                className={inputClass}
                value={values.city}
                onChange={(event) => updateField('city', event.target.value)}
                maxLength={100}
                required
              />
            </label>

            <label className={labelClass}>
              Starts *
              <input
                type="datetime-local"
                className={inputClass}
                value={values.start_at}
                onChange={(event) => updateField('start_at', event.target.value)}
                required
              />
            </label>

            <label className={labelClass}>
              Ends *
              <input
                type="datetime-local"
                className={inputClass}
                value={values.end_at}
                onChange={(event) => updateField('end_at', event.target.value)}
                required
              />
            </label>

            <label className={labelClass}>
              Host
              <input
                className={inputClass}
                value={values.host}
                onChange={(event) => updateField('host', event.target.value)}
                maxLength={200}
              />
            </label>

            <label className={labelClass}>
              Ticket information
              <input
                className={inputClass}
                value={values.ticket_price_info}
                onChange={(event) => updateField('ticket_price_info', event.target.value)}
                maxLength={500}
              />
            </label>

            <label className={`${labelClass} sm:col-span-2`}>
              Description
              <span className="relative">
                <textarea
                  className={`${inputClass} min-h-28 resize-y`}
                  value={values.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  maxLength={5000}
                />
                <button
                  type="button"
                  onClick={handleGenerateDescription}
                  disabled={generatingDescription || !values.title.trim()}
                  className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--primary)] transition hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles size={14} aria-hidden="true" />
                  {generatingDescription ? 'Generating…' : 'Draft with AI'}
                </button>
                {descriptionState && (
                  <span role={descriptionState.startsWith('Could not') || descriptionState.startsWith('Add an') ? 'alert' : 'status'} className="mt-2 block text-xs leading-5 text-[var(--text-soft)]">
                    {descriptionState}
                  </span>
                )}
              </span>
            </label>

            <label className={`${labelClass} sm:col-span-2`}>
              Booking information
              <textarea
                className={`${inputClass} min-h-20 resize-y`}
                value={values.booking_info}
                onChange={(event) => updateField('booking_info', event.target.value)}
                maxLength={500}
              />
            </label>
          </div>

          <section aria-labelledby="duplicate-check-heading" className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 id="duplicate-check-heading" className="font-semibold text-[var(--text)]">Possible duplicates</h3>
                <p className="mt-1 text-sm text-[var(--text-soft)]">
                  Compare this draft with existing event listings before submitting.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDuplicateCheck}
                disabled={checkingDuplicates || !values.title.trim()}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checkingDuplicates ? 'Checking…' : 'Check for duplicates'}
              </button>
            </div>
            {duplicateState?.error && (
              <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-300">{duplicateState.error}</p>
            )}
            {duplicateState?.duplicates && (
              duplicateState.duplicates.length > 0 ? (
                <div role="alert" className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <p className="font-semibold text-amber-700 dark:text-amber-300">
                    {duplicateState.message || 'Possible duplicate events found. Review before publishing.'}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {duplicateState.duplicates.map((duplicate) => (
                      <li key={duplicate.id} className="text-sm text-[var(--text-soft)]">
                        <a
                          href={`/events/${encodeURIComponent(duplicate.id)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-[var(--text)] underline decoration-[var(--primary)] underline-offset-2"
                        >
                          {duplicate.title}
                        </a>
                        <span> · {[duplicate.venue, duplicate.city].filter(Boolean).join(', ')}</span>
                        {duplicate.start_at && <span> · {toLocalDateTime(duplicate.start_at).replace('T', ' ')}</span>}
                        {duplicate.status && <span> · {duplicate.status}</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs leading-5 text-[var(--text-soft)]">
                    Similarity matches are advisory. Review each listing; creating this event remains a separate action.
                  </p>
                </div>
              ) : (
                <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
                  {duplicateState.message || 'No possible duplicates were found.'}
                </p>
              )
            )}
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--primary)]"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:cursor-wait disabled:opacity-70"
            >
              {saving ? 'Saving…' : event ? 'Save changes' : 'Create event'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
