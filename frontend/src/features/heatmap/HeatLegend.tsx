import { RISK_LEVELS } from '../../shared/risk/tokens'

export function HeatLegend() {
  return (
    <ul className="heat-legend" aria-label="Weather risk legend">
      {RISK_LEVELS.map((risk) => (
        <li key={risk.key}>
          <span className="swatch" style={{ background: risk.color }} aria-hidden="true" />
          <span aria-hidden="true">{risk.icon}</span> {risk.label}
        </li>
      ))}
    </ul>
  )
}
