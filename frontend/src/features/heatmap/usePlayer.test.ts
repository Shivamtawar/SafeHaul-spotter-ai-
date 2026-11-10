import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlayer } from './usePlayer'

describe('usePlayer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts paused at hour 0', () => {
    const { result } = renderHook(() => usePlayer(48, 100))
    expect(result.current).toMatchObject({ hour: 0, playing: false })
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.hour).toBe(0)
  })

  it('steps one hour per interval while playing', () => {
    const { result } = renderHook(() => usePlayer(48, 100))
    act(() => result.current.toggle())
    act(() => vi.advanceTimersByTime(350))
    expect(result.current.hour).toBe(3)
    expect(result.current.playing).toBe(true)
  })

  it('stops stepping when paused', () => {
    const { result } = renderHook(() => usePlayer(48, 100))
    act(() => result.current.toggle())
    act(() => vi.advanceTimersByTime(200))
    act(() => result.current.toggle())
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.hour).toBe(2)
    expect(result.current.playing).toBe(false)
  })

  it('wraps from the last hour back to the first', () => {
    const { result } = renderHook(() => usePlayer(3, 100))
    act(() => result.current.toggle())
    act(() => vi.advanceTimersByTime(400))
    expect(result.current.hour).toBe(0)
  })

  it('jumps to a chosen hour, clamped to the range', () => {
    const { result } = renderHook(() => usePlayer(48, 100))
    act(() => result.current.setHour(30))
    expect(result.current.hour).toBe(30)
    act(() => result.current.setHour(200))
    expect(result.current.hour).toBe(48)
    act(() => result.current.setHour(-4))
    expect(result.current.hour).toBe(0)
  })

  it('resets to hour 0 and pauses', () => {
    const { result } = renderHook(() => usePlayer(48, 100))
    act(() => result.current.setHour(20))
    act(() => result.current.toggle())
    act(() => result.current.reset())
    expect(result.current).toMatchObject({ hour: 0, playing: false })
  })

  it('stops its timer when unmounted', () => {
    const { result, unmount } = renderHook(() => usePlayer(48, 100))
    act(() => result.current.toggle())
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
