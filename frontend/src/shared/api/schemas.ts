import { z } from 'zod'

// Mirrors the backend response serializers (see /api/docs/). Parsing at the boundary means
// the rest of the app can trust these types.

const timestamp = z.iso.datetime({ offset: true })
const level = z.number().int().min(0).max(4)

export const placeSchema = z.object({
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
})
export type Place = z.infer<typeof placeSchema>

export const checkpointSchema = z.object({
  mile: z.number(),
  lat: z.number(),
  lon: z.number(),
  eta: timestamp,
  level,
  level_label: z.string(),
  wind_mph: z.number(),
  rain_in_hr: z.number(),
  snow_in_hr: z.number(),
  reasons: z.array(z.string()),
})
export type Checkpoint = z.infer<typeof checkpointSchema>

export const warningSchema = z.object({
  severity: z.enum(['critical', 'warning']),
  message: z.string(),
})
export type RouteWarning = z.infer<typeof warningSchema>

export const routeSchema = z.object({
  route_id: z.string(),
  rank: z.number().int(),
  recommended: z.boolean(),
  distance_miles: z.number(),
  duration_seconds: z.number(),
  arrival: timestamp,
  avg_risk: z.number(),
  has_no_travel: z.boolean(),
  miles_by_level: z.object({
    low: z.number(),
    moderate: z.number(),
    high: z.number(),
    severe: z.number(),
    no_travel: z.number(),
  }),
  warnings: z.array(warningSchema),
  geometry: z.array(z.tuple([z.number(), z.number()])),
  checkpoints: z.array(checkpointSchema),
})
export type Route = z.infer<typeof routeSchema>

export const heatmapSchema = z.object({
  start: timestamp,
  hours: z.number().int(),
  points: z.array(z.object({ lat: z.number(), lon: z.number(), levels: z.array(level) })),
})
export type Heatmap = z.infer<typeof heatmapSchema>

export const planSchema = z.object({
  departure: timestamp,
  load_lbs: z.number(),
  interval_miles: z.number(),
  recommended_route_id: z.string(),
  recommended_is_safe: z.boolean(),
  routes: z.array(routeSchema).min(1),
  heatmap: heatmapSchema,
})
export type Plan = z.infer<typeof planSchema>

export const errorEnvelopeSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown() }),
})

export const INTERVAL_OPTIONS = [10, 25, 50] as const
export type IntervalMiles = (typeof INTERVAL_OPTIONS)[number]

export interface PlanRequest {
  origin: Place
  destination: Place
  departure: string // ISO 8601 with offset
  load_lbs: number
  interval_miles: IntervalMiles
}
