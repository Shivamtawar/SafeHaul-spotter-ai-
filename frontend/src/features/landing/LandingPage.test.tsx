import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_TRIPS } from '../../shared/trips/sampleTrips'
import { CONDITIONS, FAQ, FEATURES, LOAD_RULES, RANKING, STEPS } from './content'
import { LandingPage } from './LandingPage'

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  )
}

describe('LandingPage', () => {
  it('leads with the promise and a clear way to start', () => {
    renderLanding()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Plan the route.Beat the storm.Arrive safe.',
    )
    const links = screen.getAllByRole('link', { name: /Plan a route/ })
    expect(links.length).toBeGreaterThanOrEqual(2)
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/plan')
    }
  })

  it('offers sample trips that open the planner with that trip', () => {
    renderLanding()
    const chip = screen.getByRole('link', { name: /Dallas → Denver/ })
    expect(chip).toHaveAttribute('href', '/plan?trip=dallas-denver')
    for (const trip of SAMPLE_TRIPS.slice(0, 3)) {
      expect(screen.getByRole('link', { name: new RegExp(trip.label) })).toBeInTheDocument()
    }
  })

  it('has a skip link and labelled main landmark', () => {
    renderLanding()
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('lists every feature', () => {
    renderLanding()
    for (const feature of FEATURES) {
      expect(screen.getByRole('heading', { name: feature.title })).toBeInTheDocument()
    }
  })

  it('shows every risk threshold from the brief', () => {
    renderLanding()
    for (const condition of CONDITIONS) {
      expect(screen.getByRole('heading', { name: new RegExp(condition.name) })).toBeInTheDocument()
    }
    const wind = screen.getByRole('heading', { name: /Wind/ }).closest('.risk-row') as HTMLElement
    for (const range of ['< 25', '25–34', '35–44', '45–54', '≥ 55']) {
      expect(within(wind).getByText(range)).toBeInTheDocument()
    }
    expect(CONDITIONS).toHaveLength(3)
  })

  it('states the load rules and the ranking order', () => {
    renderLanding()
    for (const rule of LOAD_RULES) expect(screen.getByText(rule.condition)).toBeInTheDocument()
    const ranking = screen.getByRole('heading', { name: 'How we pick the route' }).closest('div')
    for (const item of RANKING)
      expect(within(ranking as HTMLElement).getByText(item)).toBeInTheDocument()
    expect(RANKING[0]).toBe('Fewest Severe miles')
  })

  it('walks through the three steps', () => {
    renderLanding()
    for (const step of STEPS)
      expect(screen.getByRole('heading', { name: step.title })).toBeInTheDocument()
  })

  it('answers common questions and opens them on demand', async () => {
    renderLanding()
    const first = FAQ[0]!
    const summary = screen.getByText(first.question)
    const details = summary.closest('details') as HTMLDetailsElement
    expect(details.open).toBe(false)
    await userEvent.click(summary)
    expect(details.open).toBe(true)
    expect(within(details).getByText(/Open-Meteo/)).toBeInTheDocument()
  })

  it('credits its data sources and carries a safety disclaimer', () => {
    renderLanding()
    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: 'Open-Meteo' })).toHaveAttribute(
      'href',
      'https://open-meteo.com/',
    )
    expect(
      within(footer).getByText(/Always follow official road and weather advisories/),
    ).toBeInTheDocument()
  })

  it('shrinks the navigation once the page scrolls', () => {
    renderLanding()
    const nav = screen.getByRole('banner')
    expect(nav).toHaveAttribute('data-scrolled', 'false')
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true })
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(nav).toHaveAttribute('data-scrolled', 'true')
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
  })
})

describe('forecast demo', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('plays on its own, can be paused, and says it is only an example', () => {
    renderLanding()
    expect(screen.getByText('Illustrative example, not live data.')).toBeInTheDocument()
    const readout = () => screen.getByTestId('demo-readout').textContent
    const start = readout()
    act(() => vi.advanceTimersByTime(1200))
    expect(readout()).not.toBe(start)

    fireEvent.click(screen.getByRole('button', { name: 'Pause the example' }))
    const paused = readout()
    act(() => vi.advanceTimersByTime(2000))
    expect(readout()).toBe(paused)
    expect(screen.getByRole('button', { name: 'Play the example' })).toBeInTheDocument()
  })

  it('wraps back to the start after the last hour', () => {
    renderLanding()
    act(() => vi.advanceTimersByTime(380 * 60))
    const hour = Number(/\+(\d+) h/.exec(screen.getByTestId('demo-readout').textContent ?? '')?.[1])
    expect(hour).toBeLessThan(49)
  })
})
