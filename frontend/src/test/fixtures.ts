import type { Checkpoint, Plan, Route } from '../shared/api/schemas'

export function checkpoint(overrides: Partial<Checkpoint> = {}): Checkpoint {
  return {
    mile: 0,
    lat: 32.78,
    lon: -96.8,
    eta: '2026-11-12T08:00:00+00:00',
    level: 0,
    level_label: 'Low',
    wind_mph: 8,
    rain_in_hr: 0,
    snow_in_hr: 0,
    reasons: [],
    ...overrides,
  }
}

export function route(overrides: Partial<Route> = {}): Route {
  return {
    route_id: 'route-1',
    rank: 1,
    recommended: true,
    distance_miles: 784.7,
    duration_seconds: 57_600,
    arrival: '2026-11-13T00:00:00+00:00',
    avg_risk: 0.4,
    has_no_travel: false,
    miles_by_level: { low: 700, moderate: 50, high: 20.7, severe: 14, no_travel: 0 },
    warnings: [],
    geometry: [
      [32.78, -96.8],
      [39.74, -104.99],
    ],
    checkpoints: [checkpoint(), checkpoint({ mile: 25, lat: 33.1, lon: -97.2 })],
    ...overrides,
  }
}

export function plan(overrides: Partial<Plan> = {}): Plan {
  return {
    departure: '2026-11-12T08:00:00+00:00',
    load_lbs: 45_000,
    interval_miles: 25,
    recommended_route_id: 'route-1',
    recommended_is_safe: true,
    routes: [route()],
    heatmap: {
      start: '2026-11-12T08:00:00+00:00',
      hours: 49,
      points: [{ lat: 32.78, lon: -96.8, levels: Array.from({ length: 49 }, () => 0) }],
    },
    ...overrides,
  }
}
