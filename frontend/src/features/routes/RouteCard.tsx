import { CalendarCheck2, Clock3, Route as RouteIcon } from 'lucide-react'
import type { Route } from '../../shared/api/schemas'
import { formatDateTime, formatDuration, formatMiles } from '../../shared/lib/format'
import { riskByLevel, routeColor } from '../../shared/risk/tokens'
import { RiskBar } from './RiskBar'

interface RouteCardProps {
  route: Route
  index: number
  selected: boolean
  onSelect: (routeId: string) => void
}

export function RouteCard({ route, index, selected, onSelect }: RouteCardProps) {
  const critical = route.warnings.filter((w) => w.severity === 'critical')
  const others = route.warnings.filter((w) => w.severity !== 'critical')
  const averageRisk = riskByLevel(Math.round(route.avg_risk))

  const className = ['route-card', selected ? 'selected' : '', route.has_no_travel ? 'blocked' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <li>
      <button
        type="button"
        className={className}
        aria-pressed={selected}
        onClick={() => onSelect(route.route_id)}
        style={{ '--route-color': routeColor(index) } as React.CSSProperties}
      >
        <span className="route-head">
          <span className="route-rank" aria-hidden="true">
            {index + 1}
          </span>
          <span className="route-name">Route {index + 1}</span>
          {route.has_no_travel ? (
            <span className="badge badge-danger">
              <span aria-hidden="true">⛔</span> No Travel
            </span>
          ) : route.recommended ? (
            <span className="badge badge-ok">
              <span aria-hidden="true">✓</span> Recommended
            </span>
          ) : null}
        </span>

        <span className="route-stats">
          <span className="stat">
            <RouteIcon aria-hidden="true" />
            <span>
              <span className="stat-label">Distance</span>
              {formatMiles(route.distance_miles)}
            </span>
          </span>
          <span className="stat">
            <Clock3 aria-hidden="true" />
            <span>
              <span className="stat-label">Drive time</span>
              {formatDuration(route.duration_seconds)}
            </span>
          </span>
          <span className="stat stat-wide">
            <CalendarCheck2 aria-hidden="true" />
            <span>
              <span className="stat-label">Arrives</span>
              {formatDateTime(route.arrival)}
            </span>
          </span>
        </span>

        <RiskBar route={route} />

        <span className="route-risk">
          Severe {formatMiles(route.miles_by_level.severe)} · High{' '}
          {formatMiles(route.miles_by_level.high)} · Average risk {route.avg_risk.toFixed(2)} (
          {averageRisk.label})
        </span>

        {critical.map((warning) => (
          <span key={warning.message} className="alert alert-danger" role="alert">
            {warning.message}
          </span>
        ))}
        {others.map((warning) => (
          <span key={warning.message} className="alert alert-warning">
            {warning.message}
          </span>
        ))}
      </button>
    </li>
  )
}
