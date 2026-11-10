import { useEffect, useRef } from 'react'
import type { Plan } from '../../shared/api/schemas'
import { CheckpointTable } from './CheckpointTable'
import { RouteCard } from './RouteCard'

const IDEAL_ROUTE_COUNT = 3

interface RouteListProps {
  plan: Plan
  selectedId: string
  onSelect: (routeId: string) => void
}

export function RouteList({ plan, selectedId, onSelect }: RouteListProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  const selectedIndex = plan.routes.findIndex((route) => route.route_id === selectedId)
  const selected = plan.routes[selectedIndex]

  // Move focus to the results when a new plan arrives, so keyboard and screen-reader users land
  // on them instead of being left on the form button.
  useEffect(() => {
    heading.current?.focus()
  }, [plan])

  return (
    <section aria-labelledby="routes-heading">
      <h2 id="routes-heading" ref={heading} tabIndex={-1}>
        {plan.routes.length === 1 ? '1 route' : `${plan.routes.length} routes`}, safest first
      </h2>
      {!plan.recommended_is_safe && (
        <p className="alert alert-danger" role="alert">
          <span aria-hidden="true">⛔</span> No safe route: every option has No Travel weather for
          this departure. Do not dispatch. Try a different departure time.
        </p>
      )}
      {plan.routes.length < IDEAL_ROUTE_COUNT && (
        <p className="note">
          Only {plan.routes.length === 1 ? '1 route was' : `${plan.routes.length} routes were`}{' '}
          available for this trip.
        </p>
      )}
      <ul className="route-list">
        {plan.routes.map((route, index) => (
          <RouteCard
            key={route.route_id}
            route={route}
            index={index}
            selected={route.route_id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </ul>
      {selected && <CheckpointTable route={selected} name={`Route ${selectedIndex + 1}`} />}
    </section>
  )
}
