import { describe, expect, it } from 'vitest'
import { RISK_LEVELS, riskByLevel, routeColor } from './tokens'

describe('risk tokens', () => {
  it('has the five levels in severity order with unique colors', () => {
    expect(RISK_LEVELS.map((r) => r.label)).toEqual([
      'Low',
      'Moderate',
      'High',
      'Severe',
      'No Travel',
    ])
    expect(new Set(RISK_LEVELS.map((r) => r.color)).size).toBe(5)
  })

  it('gives every level an icon, so color is never the only signal', () => {
    expect(new Set(RISK_LEVELS.map((r) => r.icon)).size).toBe(5)
  })

  it('looks a level up and clamps out-of-range values', () => {
    expect(riskByLevel(3).label).toBe('Severe')
    expect(riskByLevel(-2).label).toBe('Low')
    expect(riskByLevel(99).label).toBe('No Travel')
  })

  it('cycles route colors', () => {
    expect(routeColor(0)).toBe(routeColor(3))
    expect(routeColor(0)).not.toBe(routeColor(1))
  })
})
