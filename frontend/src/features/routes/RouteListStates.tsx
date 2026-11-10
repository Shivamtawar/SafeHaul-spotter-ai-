import { Sparkles } from 'lucide-react'
import { SAMPLE_TRIPS } from '../../shared/trips/sampleTrips'
import type { SampleTrip } from '../../shared/trips/sampleTrips'

/** Placeholder cards while the plan is being computed. */
export function RouteSkeletons() {
  return (
    <div className="skeletons" aria-hidden="true">
      {[0, 1, 2].map((key) => (
        <div key={key} className="skeleton-card">
          <span className="skeleton-line wide" />
          <span className="skeleton-line" />
          <span className="skeleton-line short" />
        </div>
      ))}
    </div>
  )
}

interface EmptyStateProps {
  onPickSample?: (trip: SampleTrip) => void
}

export function EmptyState({ onPickSample }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Sparkles aria-hidden="true" />
      </span>
      <p>
        Enter a trip to compare up to three truck routes by weather risk, load weight and travel
        time.
      </p>
      {onPickSample && (
        <div className="empty-samples">
          <span>Or try a sample trip:</span>
          {SAMPLE_TRIPS.map((trip) => (
            <button key={trip.id} type="button" className="chip" onClick={() => onPickSample(trip)}>
              {trip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
