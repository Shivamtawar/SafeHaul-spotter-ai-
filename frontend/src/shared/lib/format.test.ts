import { describe, expect, it } from 'vitest'
import { defaultDeparture, formatDuration, formatMiles, toDateTimeLocal } from './format'

describe('formatMiles', () => {
  it('shows one decimal at most and thousands separators', () => {
    expect(formatMiles(784.7)).toBe('784.7 mi')
    expect(formatMiles(1234.56)).toBe('1,234.6 mi')
    expect(formatMiles(0)).toBe('0 mi')
  })
})

describe('formatDuration', () => {
  it('shows hours and minutes', () => {
    expect(formatDuration(57_600)).toBe('16h 0m')
    expect(formatDuration(3_660)).toBe('1h 1m')
  })

  it('omits hours when under an hour', () => {
    expect(formatDuration(1_800)).toBe('30m')
  })

  it('rounds to the nearest minute', () => {
    expect(formatDuration(3_629)).toBe('1h 0m')
    expect(formatDuration(3_631)).toBe('1h 1m')
  })
})

describe('toDateTimeLocal', () => {
  it('formats local time for a datetime-local input', () => {
    expect(toDateTimeLocal(new Date(2026, 10, 5, 9, 7))).toBe('2026-11-05T09:07')
  })
})

describe('defaultDeparture', () => {
  it('is the next quarter hour at least 30 minutes ahead', () => {
    const now = new Date(2026, 10, 5, 9, 7)
    expect(toDateTimeLocal(defaultDeparture(now))).toBe('2026-11-05T09:45')
  })

  it('keeps an exact quarter hour', () => {
    const now = new Date(2026, 10, 5, 9, 15)
    expect(toDateTimeLocal(defaultDeparture(now))).toBe('2026-11-05T09:45')
  })
})
