import type { Route } from '../../shared/api/schemas'
import { RISK_LEVELS } from '../../shared/risk/tokens'
import { formatMiles } from '../../shared/lib/format'

/** Stacked bar of how many miles of the route fall in each risk level. */
export function RiskBar({ route }: { route: Route }) {
  const total = RISK_LEVELS.reduce((sum, risk) => sum + route.miles_by_level[risk.key], 0)
  const present = RISK_LEVELS.filter((risk) => route.miles_by_level[risk.key] > 0)
  const summary = present
    .map((risk) => `${risk.label} ${formatMiles(route.miles_by_level[risk.key])}`)
    .join(', ')

  return (
    <div>
      <div className="risk-bar" role="img" aria-label={`Miles by weather risk: ${summary}`}>
        {present.map((risk) => (
          <span
            key={risk.key}
            style={{
              flexGrow: route.miles_by_level[risk.key] / (total || 1),
              background: risk.color,
            }}
          />
        ))}
      </div>
      <ul className="risk-legend">
        {present.map((risk) => (
          <li key={risk.key}>
            <span className="swatch" style={{ background: risk.color }} aria-hidden="true" />
            <span aria-hidden="true">{risk.icon}</span> {risk.label}{' '}
            {formatMiles(route.miles_by_level[risk.key])}
          </li>
        ))}
      </ul>
    </div>
  )
}
