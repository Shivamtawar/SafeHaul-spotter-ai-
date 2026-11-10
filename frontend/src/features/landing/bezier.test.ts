import { describe, expect, it } from 'vitest'
import { cubicAt, pathData, pointsAlong } from './bezier'
import type { Segment } from './bezier'

const straight: Segment = [
  [0, 0],
  [10, 0],
  [20, 0],
  [30, 0],
]
const second: Segment = [
  [30, 0],
  [30, 10],
  [30, 20],
  [30, 30],
]

describe('cubicAt', () => {
  it('starts and ends at the end points', () => {
    expect(cubicAt(straight, 0)).toEqual([0, 0])
    expect(cubicAt(straight, 1)).toEqual([30, 0])
  })

  it('passes through the middle of a straight segment', () => {
    expect(cubicAt(straight, 0.5)[0]).toBeCloseTo(15)
    expect(cubicAt(straight, 0.5)[1]).toBeCloseTo(0)
  })
})

describe('pathData', () => {
  it('builds SVG path data from chained segments', () => {
    expect(pathData([straight, second])).toBe('M0 0 C10 0 20 0 30 0 C30 10 30 20 30 30')
  })

  it('is empty without segments', () => {
    expect(pathData([])).toBe('')
  })

  it('rounds to one decimal place', () => {
    const odd: Segment = [
      [0.04, 0.06],
      [1.234, 2],
      [3, 4],
      [5.678, 6],
    ]
    expect(pathData([odd])).toBe('M0 0.1 C1.2 2 3 4 5.7 6')
  })
})

describe('pointsAlong', () => {
  it('spreads points evenly across segments, ends included', () => {
    const points = pointsAlong([straight, second], 5)
    expect(points).toHaveLength(5)
    expect(points[0]).toEqual([0, 0])
    expect(points[2]).toEqual([30, 0]) // the join between the two segments
    expect(points[4]).toEqual([30, 30])
  })

  it('handles a single point and no points', () => {
    expect(pointsAlong([straight], 1)).toEqual([[0, 0]])
    expect(pointsAlong([straight], 0)).toEqual([])
    expect(pointsAlong([], 4)).toEqual([])
  })
})
