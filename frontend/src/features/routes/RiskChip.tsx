import { riskByLevel } from '../../shared/risk/tokens'

/** A risk level as color swatch + icon + text, so it reads without relying on color. */
export function RiskChip({ level }: { level: number }) {
  const risk = riskByLevel(level)
  return (
    <span className="risk-chip">
      <span className="swatch" style={{ background: risk.color }} aria-hidden="true" />
      <span aria-hidden="true">{risk.icon}</span> {risk.label}
    </span>
  )
}
