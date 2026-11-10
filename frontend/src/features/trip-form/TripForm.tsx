import { ArrowRight, ArrowUpDown, CalendarClock, Flag, Loader2, MapPin, Weight } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { INTERVAL_OPTIONS } from '../../shared/api/schemas'
import type { IntervalMiles, Place, PlanRequest } from '../../shared/api/schemas'
import { defaultDeparture, toDateTimeLocal } from '../../shared/lib/format'
import type { SampleTrip } from '../../shared/trips/sampleTrips'
import { PlaceInput } from './PlaceInput'

const MAX_LOAD_LBS = 120_000

interface TripFormProps {
  onSubmit: (request: PlanRequest) => void
  isPending: boolean
  debounceMs?: number
  /** A ready-made trip to fill in (from a sample-trip button or the landing page). */
  preset?: SampleTrip | null
}

interface FormErrors {
  origin?: string
  destination?: string
  departure?: string
  load?: string
}

export function TripForm({ onSubmit, isPending, debounceMs, preset = null }: TripFormProps) {
  const [origin, setOrigin] = useState<Place | null>(preset?.origin ?? null)
  const [destination, setDestination] = useState<Place | null>(preset?.destination ?? null)
  const [departure, setDeparture] = useState(() => toDateTimeLocal(defaultDeparture()))
  const [load, setLoad] = useState('40000')
  const [interval, setInterval] = useState<IntervalMiles>(25)
  const [errors, setErrors] = useState<FormErrors>({})

  // Apply a new preset during render (not in an effect), so the form never shows stale places.
  const [appliedPreset, setAppliedPreset] = useState(preset)
  if (preset !== appliedPreset) {
    setAppliedPreset(preset)
    if (preset) {
      setOrigin(preset.origin)
      setDestination(preset.destination)
      setErrors({})
    }
  }

  function swap() {
    setOrigin(destination)
    setDestination(origin)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const found: FormErrors = {}
    const loadLbs = Number(load)
    const departureDate = new Date(departure)

    if (!origin) found.origin = 'Choose a starting place from the list.'
    if (!destination) found.destination = 'Choose a destination from the list.'
    if (!departure || Number.isNaN(departureDate.getTime())) {
      found.departure = 'Enter a departure date and time.'
    }
    if (!Number.isInteger(loadLbs) || loadLbs < 1 || loadLbs > MAX_LOAD_LBS) {
      found.load = `Enter a whole number of pounds from 1 to ${MAX_LOAD_LBS.toLocaleString('en-US')}.`
    }
    setErrors(found)
    if (Object.keys(found).length > 0 || !origin || !destination) return

    onSubmit({
      origin,
      destination,
      departure: departureDate.toISOString(),
      load_lbs: loadLbs,
      interval_miles: interval,
    })
  }

  return (
    <form className="trip-form" onSubmit={handleSubmit} noValidate>
      <div className="places">
        <PlaceInput
          label="From"
          value={origin}
          onChange={setOrigin}
          error={errors.origin}
          debounceMs={debounceMs}
          icon={MapPin}
        />
        <button
          type="button"
          className="swap"
          onClick={swap}
          aria-label="Swap start and destination"
        >
          <ArrowUpDown aria-hidden="true" />
        </button>
        <PlaceInput
          label="To"
          value={destination}
          onChange={setDestination}
          error={errors.destination}
          debounceMs={debounceMs}
          icon={Flag}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="departure">Departure</label>
          <div className="input-wrap">
            <CalendarClock className="input-icon" aria-hidden="true" />
            <input
              id="departure"
              type="datetime-local"
              value={departure}
              onChange={(event) => setDeparture(event.target.value)}
              aria-invalid={errors.departure ? true : undefined}
              aria-describedby={errors.departure ? 'departure-error' : undefined}
            />
          </div>
          {errors.departure && (
            <p id="departure-error" className="field-error" role="alert">
              {errors.departure}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="load">Load weight (lb)</label>
          <div className="input-wrap">
            <Weight className="input-icon" aria-hidden="true" />
            <input
              id="load"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_LOAD_LBS}
              step={1}
              value={load}
              onChange={(event) => setLoad(event.target.value)}
              aria-invalid={errors.load ? true : undefined}
              aria-describedby={errors.load ? 'load-error' : undefined}
            />
          </div>
          {errors.load && (
            <p id="load-error" className="field-error" role="alert">
              {errors.load}
            </p>
          )}
        </div>
      </div>

      <fieldset className="field interval">
        <legend>Weather checkpoint every</legend>
        <div className="segmented">
          {INTERVAL_OPTIONS.map((miles) => (
            <label key={miles} className={interval === miles ? 'segment selected' : 'segment'}>
              <input
                type="radio"
                name="interval"
                value={miles}
                checked={interval === miles}
                onChange={() => setInterval(miles)}
              />
              {miles} mi
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" className="btn btn-dark submit" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="spin" aria-hidden="true" /> Checking the weather…
          </>
        ) : (
          <>
            Find the safest route
            <ArrowRight className="arrow" aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  )
}
