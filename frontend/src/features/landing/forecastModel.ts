export const DEMO_HOURS = 48
export const DEMO_ROUTES = 3

/**
 * An illustrative storm for the landing page (not real data): a front sweeping across three
 * routes at different speeds. Returns the risk level, 0 (Low) to 4 (No Travel), for one cell.
 */
export function demoLevel(route: number, hour: number): number {
  const centers = [15, 22, 30] // the hour the storm is overhead for each route
  const widths = [4, 8, 5]
  const intensity = [2.2, 4.4, 3.2]
  const distance = Math.abs(hour - (centers[route] ?? 20)) / (widths[route] ?? 5)
  const raw = (intensity[route] ?? 3) * Math.exp(-distance * distance)
  return Math.max(0, Math.min(4, Math.round(raw)))
}

export function demoRow(route: number): number[] {
  return Array.from({ length: DEMO_HOURS + 1 }, (_, hour) => demoLevel(route, hour))
}

/** The worst level on any route at one hour. */
export function demoWorst(hour: number): number {
  return Math.max(...Array.from({ length: DEMO_ROUTES }, (_, route) => demoLevel(route, hour)))
}
