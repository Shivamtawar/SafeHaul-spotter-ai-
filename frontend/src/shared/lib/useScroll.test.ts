import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePageProgress, useScrolled } from './useScroll'

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  window.dispatchEvent(new Event('scroll'))
}

describe('useScrolled', () => {
  afterEach(() => scrollTo(0))

  it('turns true once the page scrolls past the threshold', () => {
    const { result } = renderHook(() => useScrolled(40))
    expect(result.current).toBe(false)
    act(() => scrollTo(41))
    expect(result.current).toBe(true)
    act(() => scrollTo(10))
    expect(result.current).toBe(false)
  })
})

describe('usePageProgress', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    scrollTo(0)
  })

  it('reports how far down the page the reader is', () => {
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(2000)
    vi.stubGlobal('innerHeight', 1000)
    const queue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => queue.push(callback))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const flush = () => act(() => queue.splice(0).forEach((callback) => callback(0)))

    const { result } = renderHook(() => usePageProgress())
    expect(result.current).toBe(0)
    scrollTo(500)
    flush()
    expect(result.current).toBeCloseTo(0.5)
    scrollTo(5000)
    flush()
    expect(result.current).toBe(1)
  })
})
