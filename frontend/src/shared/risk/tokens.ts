// The single source of truth for how each risk level looks. Colors are always paired with the
// text label in the UI, so meaning never depends on color alone.

export type RiskKey = 'low' | 'moderate' | 'high' | 'severe' | 'no_travel'

export interface RiskLevel {
  level: 0 | 1 | 2 | 3 | 4
  key: RiskKey
  label: string
  color: string
  icon: string // shown beside the label, so risk never depends on color alone
}

export const RISK_LEVELS: readonly RiskLevel[] = [
  { level: 0, key: 'low', label: 'Low', color: '#15803d', icon: '✓' },
  { level: 1, key: 'moderate', label: 'Moderate', color: '#ca8a04', icon: '!' },
  { level: 2, key: 'high', label: 'High', color: '#ea580c', icon: '▲' },
  { level: 3, key: 'severe', label: 'Severe', color: '#dc2626', icon: '✖' },
  { level: 4, key: 'no_travel', label: 'No Travel', color: '#7f1d1d', icon: '⛔' },
]

export function riskByLevel(level: number): RiskLevel {
  return RISK_LEVELS[Math.min(Math.max(level, 0), RISK_LEVELS.length - 1)] as RiskLevel
}

// Route identity colors; deliberately unlike the green-to-red risk scale.
export const ROUTE_COLORS = ['#158280', '#2b4a8b', '#5b8fb9'] as const

export function routeColor(index: number): string {
  return ROUTE_COLORS[index % ROUTE_COLORS.length] as string
}
