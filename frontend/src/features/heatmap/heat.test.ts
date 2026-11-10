import { describe, expect, it } from 'vitest'
import { plan } from '../../test/fixtures'
import {
  FORECAST_HOURS,
  advanceHour,
  blobRadiusPx,
  clampHour,
  forecastTime,
  heatPointsAt,
  metersPerPixel,
  paintOrder,
} from './heat'

const heatmap = {
  start: '2026-11-12T08:00:00+00:00',
  hours: 49,
  points: [
    { lat: 32.8, lon: -96.8, levels: Array.from({ length: 49 }, (_, h) => (h < 10 ? 0 : 4)) },
    { lat: 36.0, lon: -100.5, levels: Array.from({ length: 49 }, (_, h) => Math.min(h, 4)) },
  ],
}

describe('heatPointsAt', () => {
  it('returns a point with its risk level for the chosen hour', () => {
    expect(heatPointsAt(heatmap, 0)).toEqual([
      { lat: 32.8, lon: -96.8, level: 0 },
      { lat: 36.0, lon: -100.5, level: 0 },
    ])
  })

  it('changes with the hour', () => {
    expect(heatPointsAt(heatmap, 12).map((p) => p.level)).toEqual([4, 4])
    expect(heatPointsAt(heatmap, 2).map((p) => p.level)).toEqual([0, 2])
  })

  it('clamps hours outside the data', () => {
    expect(heatPointsAt(heatmap, 500)).toEqual(heatPointsAt(heatmap, 48))
    expect(heatPointsAt(heatmap, -5)).toEqual(heatPointsAt(heatmap, 0))
  })

  it('skips points that have no levels', () => {
    const empty = { ...heatmap, points: [{ lat: 1, lon: 2, levels: [] }] }
    expect(heatPointsAt(empty, 3)).toEqual([])
  })

  it('works on the fixture plan from the API', () => {
    expect(heatPointsAt(plan().heatmap, 20)).toHaveLength(1)
  })
})

describe('paintOrder', () => {
  it('puts the highest risk last so it is painted on top', () => {
    const points = [
      { lat: 0, lon: 0, level: 3 },
      { lat: 0, lon: 1, level: 0 },
      { lat: 0, lon: 2, level: 4 },
    ]
    expect(paintOrder(points).map((p) => p.level)).toEqual([0, 3, 4])
  })

  it('does not change the input', () => {
    const points = [
      { lat: 0, lon: 0, level: 2 },
      { lat: 0, lon: 1, level: 1 },
    ]
    paintOrder(points)
    expect(points.map((p) => p.level)).toEqual([2, 1])
  })
})

describe('metersPerPixel', () => {
  it('matches the standard web-map resolution at the equator', () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(156_543.03, 1)
  })

  it('halves with every zoom level and shrinks away from the equator', () => {
    expect(metersPerPixel(0, 5)).toBeCloseTo(metersPerPixel(0, 4) / 2, 6)
    expect(metersPerPixel(60, 4)).toBeCloseTo(metersPerPixel(0, 4) / 2, 1)
  })
})

describe('blobRadiusPx', () => {
  it('grows as the map zooms in, within its limits', () => {
    expect(blobRadiusPx(35, 4)).toBeLessThan(blobRadiusPx(35, 8))
    expect(blobRadiusPx(35, 1)).toBe(16)
    expect(blobRadiusPx(35, 14)).toBe(70)
  })
})

describe('forecastTime', () => {
  it('is the departure hour plus the offset', () => {
    expect(forecastTime(heatmap, 0).toISOString()).toBe('2026-11-12T08:00:00.000Z')
    expect(forecastTime(heatmap, 30).toISOString()).toBe('2026-11-13T14:00:00.000Z')
  })
})

describe('advanceHour', () => {
  it('steps forward and wraps after the last hour', () => {
    expect(advanceHour(0)).toBe(1)
    expect(advanceHour(FORECAST_HOURS - 1)).toBe(FORECAST_HOURS)
    expect(advanceHour(FORECAST_HOURS)).toBe(0)
  })

  it('respects a shorter forecast', () => {
    expect(advanceHour(5, 5)).toBe(0)
  })
})

describe('clampHour', () => {
  it('keeps the hour within 0 to the maximum and rounds', () => {
    expect(clampHour(-3)).toBe(0)
    expect(clampHour(99)).toBe(FORECAST_HOURS)
    expect(clampHour(12.6)).toBe(13)
    expect(clampHour(7, 5)).toBe(5)
  })
})
