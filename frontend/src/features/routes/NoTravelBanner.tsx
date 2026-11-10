import type { Plan } from '../../shared/api/schemas'

interface NoTravelBannerProps {
  plan: Plan
  selectedId: string
  onSelect: (routeId: string) => void
}

/** Shown over the map whenever the selected route has No Travel weather. Never dismissible. */
export function NoTravelBanner({ plan, selectedId, onSelect }: NoTravelBannerProps) {
  const index = plan.routes.findIndex((route) => route.route_id === selectedId)
  const selected = plan.routes[index]
  if (!selected?.has_no_travel) return null

  const safer = plan.recommended_is_safe
    ? plan.routes.find((route) => route.route_id === plan.recommended_route_id)
    : undefined

  return (
    <div className="no-travel-banner" role="alert">
      <strong>
        <span aria-hidden="true">⛔</span> NO TRAVEL on Route {index + 1}
      </strong>
      <span>
        Unsafe weather on this route at this departure time. Do not dispatch.
        {!safer && ' Every route is affected: try a different departure time.'}
      </span>
      {safer && (
        <button type="button" onClick={() => onSelect(safer.route_id)}>
          Show the recommended route
        </button>
      )}
    </div>
  )
}
