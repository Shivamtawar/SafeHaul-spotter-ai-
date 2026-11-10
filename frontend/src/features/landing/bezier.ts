export type Point = readonly [number, number]
export type Segment = readonly [Point, Point, Point, Point] // start, control 1, control 2, end

export function cubicAt([p0, p1, p2, p3]: Segment, t: number): Point {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ]
}

/** SVG path data for a chain of cubic segments that share their end and start points. */
export function pathData(segments: readonly Segment[]): string {
  const [first] = segments
  if (!first) return ''
  const round = (n: number) => Math.round(n * 10) / 10
  const move = `M${round(first[0][0])} ${round(first[0][1])}`
  const curves = segments.map(
    ([, c1, c2, end]) =>
      `C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(end[0])} ${round(end[1])}`,
  )
  return [move, ...curves].join(' ')
}

/** `count` points spread evenly (by parameter) along a chain of segments, ends included. */
export function pointsAlong(segments: readonly Segment[], count: number): Point[] {
  if (segments.length === 0 || count < 1) return []
  if (count === 1) return [cubicAt(segments[0] as Segment, 0)]
  return Array.from({ length: count }, (_, index) => {
    const position = (index / (count - 1)) * segments.length
    const segmentIndex = Math.min(Math.floor(position), segments.length - 1)
    return cubicAt(segments[segmentIndex] as Segment, position - segmentIndex)
  })
}
