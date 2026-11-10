import { describe, expect, it } from 'vitest'
import { DEMO_HOURS, DEMO_ROUTES, demoLevel, demoRow, demoWorst } from './forecastModel'

describe('demo forecast', () => {
  it('has a level from 0 to 4 for every route and hour', () => {
    for (let route = 0; route < DEMO_ROUTES; route++) {
      for (let hour = 0; hour <= DEMO_HOURS; hour++) {
        const level = demoLevel(route, hour)
        expect(level).toBeGreaterThanOrEqual(0)
        expect(level).toBeLessThanOrEqual(4)
      }
    }
  })

  it('rows cover the full 48 hours', () => {
    expect(demoRow(1)).toHaveLength(DEMO_HOURS + 1)
  })

  it('is calm at the start and the end, and stormy in the middle', () => {
    expect(demoWorst(0)).toBe(0)
    expect(demoWorst(DEMO_HOURS)).toBe(0)
    expect(Math.max(...Array.from({ length: DEMO_HOURS + 1 }, (_, h) => demoWorst(h)))).toBe(4)
  })

  it('hits route 2 hardest, which is the one that reaches No Travel', () => {
    expect(Math.max(...demoRow(1))).toBe(4)
    expect(Math.max(...demoRow(0))).toBeLessThan(4)
  })

  it('worst is the maximum across routes at that hour', () => {
    const hour = 22
    expect(demoWorst(hour)).toBe(
      Math.max(demoLevel(0, hour), demoLevel(1, hour), demoLevel(2, hour)),
    )
  })

  it('falls back safely for an unknown route', () => {
    expect(demoLevel(99, 20)).toBeGreaterThanOrEqual(0)
  })
})
