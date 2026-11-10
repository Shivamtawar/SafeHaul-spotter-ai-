import './planner.css'
import { useMutation } from '@tanstack/react-query'
import { Suspense, lazy, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ErrorBoundary } from '../../app/ErrorBoundary'
import { ApiError, planTrip } from '../../shared/api/client'
import type { PlanRequest } from '../../shared/api/schemas'
import { findSampleTrip } from '../../shared/trips/sampleTrips'
import type { SampleTrip } from '../../shared/trips/sampleTrips'
import { SiteNav } from '../../shared/ui/SiteNav'
import { HeatLegend } from '../heatmap/HeatLegend'
import { TimeSlider } from '../heatmap/TimeSlider'
import { heatPointsAt } from '../heatmap/heat'
import { usePlayer } from '../heatmap/usePlayer'
import { NoTravelBanner } from '../routes/NoTravelBanner'
import { RouteList } from '../routes/RouteList'
import { EmptyState, RouteSkeletons } from '../routes/RouteListStates'
import { TripForm } from '../trip-form/TripForm'

// The map pulls in Leaflet; load it separately so the form appears immediately.
const MapView = lazy(() => import('../map/MapView').then((m) => ({ default: m.MapView })))

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

export function PlannerPage() {
  const [params] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [request, setRequest] = useState<PlanRequest | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [preset, setPreset] = useState<SampleTrip | null>(
    () => findSampleTrip(params.get('trip')) ?? null,
  )
  const player = usePlayer()

  const mutation = useMutation({ mutationFn: (body: PlanRequest) => planTrip(body) })
  const plan = mutation.data ?? null
  const activeId = selectedId ?? plan?.recommended_route_id ?? null

  // Recomputed only when the hour or the plan changes; the data itself is already in memory.
  const heatPoints = useMemo(
    () => (plan ? heatPointsAt(plan.heatmap, player.hour) : []),
    [plan, player.hour],
  )
  const worstLevel = heatPoints.reduce((worst, point) => Math.max(worst, point.level), 0)

  function submit(body: PlanRequest) {
    setSelectedId(null)
    player.reset()
    setRequest(body)
    mutation.mutate(body)
  }

  return (
    <div className={plan ? 'planner has-plan' : 'planner'}>
      <a className="skip-link" href="#planner-main">
        Skip to the planner
      </a>
      <SiteNav variant="app" />

      <main className="panel" id="planner-main">
        <header className="brand">
          <h1>Plan your trip</h1>
          <p>Compare routes by the weather your truck will actually meet.</p>
        </header>

        <TripForm onSubmit={submit} isPending={mutation.isPending} preset={preset} />

        <div aria-live="polite" aria-busy={mutation.isPending}>
          {mutation.isPending && (
            <>
              <p className="status">Finding routes and checking the weather along each one…</p>
              <RouteSkeletons />
            </>
          )}
          {mutation.isError && (
            <div className="alert alert-danger" role="alert">
              <p>{describeError(mutation.error)}</p>
              {request && (
                <button type="button" className="retry" onClick={() => submit(request)}>
                  Try again
                </button>
              )}
            </div>
          )}
        </div>

        {!plan && !mutation.isPending && !mutation.isError && (
          <EmptyState onPickSample={(trip) => setPreset({ ...trip })} />
        )}

        {plan && activeId && !mutation.isPending && (
          <RouteList plan={plan} selectedId={activeId} onSelect={setSelectedId} />
        )}
      </main>

      <section className="map-area" aria-label="Map and weather forecast">
        <ErrorBoundary
          fallback={
            <p className="alert alert-danger map-error" role="alert">
              The map could not be displayed. The route details are still available in the list.
            </p>
          }
        >
          <Suspense fallback={<p className="status map-loading">Loading map…</p>}>
            <MapView
              plan={plan}
              selectedId={activeId}
              onSelect={setSelectedId}
              origin={request?.origin ?? null}
              destination={request?.destination ?? null}
              heatPoints={heatPoints}
              showHeatmap={showHeatmap}
            />
          </Suspense>
        </ErrorBoundary>
        <HeatLegend />
        {plan && activeId && (
          <NoTravelBanner plan={plan} selectedId={activeId} onSelect={setSelectedId} />
        )}
        {plan && (
          <TimeSlider
            heatmap={plan.heatmap}
            hour={player.hour}
            playing={player.playing}
            onHourChange={player.setHour}
            onTogglePlay={player.toggle}
            showHeatmap={showHeatmap}
            onToggleHeatmap={setShowHeatmap}
            worstLevel={worstLevel}
          />
        )}
      </section>
    </div>
  )
}
