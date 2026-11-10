import type { Page, Route } from '@playwright/test'

// A 1x1 transparent PNG, served for every map tile so tests never touch the network.
const BLANK_TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const DALLAS = { name: 'Dallas, TX, USA', lat: 32.7767, lon: -96.797 }
const DENVER = { name: 'Denver, CO, USA', lat: 39.7392, lon: -104.9903 }
const PLACES = [DALLAS, DENVER]

function line(midLat: number, steps = 40): [number, number][] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    const bend = Math.sin(Math.PI * t) * (midLat - 36)
    return [
      DALLAS.lat + (DENVER.lat - DALLAS.lat) * t + bend,
      DALLAS.lon + (DENVER.lon - DALLAS.lon) * t,
    ]
  })
}

const LEVELS = ['Low', 'Moderate', 'High', 'Severe', 'No Travel']

function checkpoints(geometry: [number, number][], levelAt: (index: number) => number) {
  const departure = Date.parse('2026-11-12T08:00:00Z')
  return geometry
    .filter((_, i) => i % 8 === 0)
    .map(([lat, lon], index) => {
      const level = levelAt(index)
      return {
        mile: index * 100,
        lat,
        lon,
        eta: new Date(departure + index * 3_600_000 * 2).toISOString().replace('.000Z', '+00:00'),
        level,
        level_label: LEVELS[level] ?? 'Low',
        wind_mph: level === 4 ? 61 : 8 + level * 8,
        rain_in_hr: 0,
        snow_in_hr: 0,
        reasons: level === 4 ? ['Wind 61 mph: No Travel'] : [],
      }
    })
}

function route(
  id: string,
  rank: number,
  midLat: number,
  miles: number,
  blocked: boolean,
): Record<string, unknown> {
  const geometry = line(midLat)
  return {
    route_id: id,
    rank,
    recommended: rank === 1,
    distance_miles: miles,
    duration_seconds: miles * 60,
    arrival: '2026-11-13T00:00:00+00:00',
    avg_risk: blocked ? 1.6 : 0.2,
    has_no_travel: blocked,
    miles_by_level: blocked
      ? { low: miles - 220, moderate: 0, high: 60, severe: 60, no_travel: 100 }
      : { low: miles, moderate: 0, high: 0, severe: 0, no_travel: 0 },
    warnings: blocked
      ? [
          {
            severity: 'critical',
            message:
              'NO TRAVEL - DO NOT DISPATCH. 2 checkpoint(s) cover about 100 miles of unsafe weather.',
          },
        ]
      : [],
    geometry,
    checkpoints: checkpoints(geometry, (i) => (blocked && i >= 2 && i <= 3 ? 4 : 0)),
  }
}

export function planBody(): Record<string, unknown> {
  const points = line(36).filter((_, i) => i % 4 === 0)
  return {
    departure: '2026-11-12T08:00:00+00:00',
    load_lbs: 45_000,
    interval_miles: 25,
    recommended_route_id: 'route-1',
    recommended_is_safe: true,
    routes: [
      route('route-1', 1, 36, 790, false),
      route('route-2', 2, 41, 860, true),
      route('route-3', 3, 31, 880, false),
    ],
    heatmap: {
      start: '2026-11-12T08:00:00+00:00',
      hours: 49,
      points: points.map(([lat, lon], index) => ({
        lat,
        lon,
        levels: Array.from({ length: 49 }, (_, hour) => ((index + hour) % 12 < 2 ? 3 : 0)),
      })),
    },
  }
}

interface MockOptions {
  /** When set, POST /plan answers with this error envelope instead of a plan. */
  planError?: { status: number; code: string; message: string }
  /** Number of leading plan requests that fail before one succeeds. */
  failFirst?: number
}

export interface MockedApi {
  planRequests: () => number
}

export async function mockApi(page: Page, options: MockOptions = {}): Promise<MockedApi> {
  let planRequests = 0
  let failuresLeft = options.failFirst ?? 0

  await page.route('**/tile.openstreetmap.org/**', (route: Route) =>
    route.fulfill({ contentType: 'image/png', body: BLANK_TILE }),
  )
  await page.route('**/api/v1/geocode**', (route: Route) => {
    const query = new URL(route.request().url()).searchParams.get('q')?.toLowerCase() ?? ''
    return route.fulfill({
      json: PLACES.filter((p) => p.name.toLowerCase().startsWith(query.slice(0, 3))),
    })
  })
  await page.route('**/api/v1/plan', (route: Route) => {
    planRequests += 1
    const error = options.planError
    if (error && (failuresLeft > 0 || options.failFirst === undefined)) {
      failuresLeft -= 1
      return route.fulfill({
        status: error.status,
        json: { error: { code: error.code, message: error.message, details: null } },
      })
    }
    return route.fulfill({ json: planBody() })
  })
  return { planRequests: () => planRequests }
}

export async function chooseTrip(page: Page): Promise<void> {
  await page.getByRole('combobox', { name: 'From' }).fill('Dallas')
  await page.getByRole('option', { name: DALLAS.name }).click()
  await page.getByRole('combobox', { name: 'To' }).fill('Denver')
  await page.getByRole('option', { name: DENVER.name }).click()
}

export async function planTrip(page: Page): Promise<void> {
  await chooseTrip(page)
  await page.getByRole('button', { name: /find the safest route/i }).click()
  await page.getByRole('heading', { name: '3 routes, safest first' }).waitFor()
}
