import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Reveal } from '../../features/landing/Reveal'
import { usePrefersReducedMotion } from './useReveal'

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void

describe('Reveal', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows content immediately when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<Reveal>hello</Reveal>)
    expect(screen.getByText('hello')).toHaveAttribute('data-revealed', 'true')
  })

  it('reveals once when it scrolls into view, then stops watching', () => {
    let notify: Callback = () => {}
    const unobserve = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: Callback) {
          notify = callback
        }
        observe() {}
        unobserve = unobserve
        disconnect() {}
      },
    )
    render(<Reveal delay={120}>later</Reveal>)
    const element = screen.getByText('later')
    expect(element).not.toHaveAttribute('data-revealed')
    expect(element.style.getPropertyValue('--delay')).toBe('120ms')

    notify([{ isIntersecting: false, target: element }])
    expect(element).not.toHaveAttribute('data-revealed')

    notify([{ isIntersecting: true, target: element }])
    expect(element).toHaveAttribute('data-revealed', 'true')
    expect(unobserve).toHaveBeenCalledWith(element)
  })
})

describe('usePrefersReducedMotion', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads the media query', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    expect(usePrefersReducedMotion()).toBe(true)
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(usePrefersReducedMotion()).toBe(false)
  })

  it('is false where matchMedia does not exist', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(usePrefersReducedMotion()).toBe(false)
  })
})
