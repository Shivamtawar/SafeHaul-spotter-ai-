import type { Heatmap } from '../../shared/api/schemas'

export const FORECAST_HOURS = 48
const HOUR_MS = 60 * 60 * 1000

export interface HeatPoint {
  lat: number
  lon: number
  level: number
}

/** Points for one forecast hour. Hours outside the data are clamped to the nearest one. */
export function heatPointsAt(heatmap: Heatmap, hour: number): HeatPoint[] {
  return heatmap.points.flatMap((point) => {
    const level = point.levels[Math.min(Math.max(hour, 0), point.levels.length - 1)]
    return level === undefined ? [] : [{ lat: point.lat, lon: point.lon, level }]
  })
}

/** Lowest risk first, so higher risk is painted on top where blobs overlap. */
export function paintOrder(points: HeatPoint[]): HeatPoint[] {
  return [...points].sort((a, b) => a.level - b.level)
}

const EARTH_CIRCUMFERENCE_METERS = 40_075_016.686
const TILE_SIZE = 256
/** How far a checkpoint's weather is shown to reach on each side of the road. */
const CORRIDOR_RADIUS_METERS = 30_000
const MIN_RADIUS_PX = 16
const MAX_RADIUS_PX = 70

export function metersPerPixel(latitude: number, zoom: number): number {
  return (
    (EARTH_CIRCUMFERENCE_METERS * Math.cos((latitude * Math.PI) / 180)) / (TILE_SIZE * 2 ** zoom)
  )
}

/** On-screen radius of one checkpoint's blob: constant in miles, clamped so it stays visible. */
export function blobRadiusPx(latitude: number, zoom: number): number {
  const pixels = CORRIDOR_RADIUS_METERS / metersPerPixel(latitude, zoom)
  return Math.min(Math.max(pixels, MIN_RADIUS_PX), MAX_RADIUS_PX)
}

/** The moment a forecast hour refers to: the departure hour plus `hour` hours. */
export function forecastTime(heatmap: Heatmap, hour: number): Date {
  return new Date(new Date(heatmap.start).getTime() + hour * HOUR_MS)
}

/** Next hour for the animation; wraps from the last hour back to the first. */
export function advanceHour(hour: number, max: number = FORECAST_HOURS): number {
  return hour >= max ? 0 : hour + 1
}

export function clampHour(hour: number, max: number = FORECAST_HOURS): number {
  return Math.min(Math.max(Math.round(hour), 0), max)
}
