import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { plan, route } from '../../test/fixtures'
import { RouteList } from './RouteList'

const stormy = route({
  route_id: 'route-2',
  rank: 2,
  recommended: false,
  has_no_travel: true,
  distance_miles: 852.6,
  miles_by_level: { low: 600, moderate: 0, high: 0, severe: 100, no_travel: 152.6 },
  warnings: [
    { severity: 'critical', message: 'NO TRAVEL - DO NOT DISPATCH. 3 checkpoint(s) unsafe.' },
    { severity: 'warning', message: 'Severe weather over about 100 miles of this route.' },
  ],
})

describe('RouteList', () => {
  it('shows each route with its distance, drive time and arrival', () => {
    render(
      <RouteList
        plan={plan({ routes: [route(), stormy] })}
        selectedId="route-1"
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: '2 routes, safest first' })).toBeInTheDocument()
    const first = screen.getByRole('button', { name: /route 1/i })
    expect(within(first).getByText('784.7 mi')).toBeInTheDocument()
    expect(within(first).getByText('16h 0m')).toBeInTheDocument()
    expect(within(first).getByText('Recommended')).toBeInTheDocument()
  })

  it('summarizes severe and high miles and average risk', () => {
    render(<RouteList plan={plan()} selectedId="route-1" onSelect={vi.fn()} />)
    expect(
      screen.getByText(/Severe 14 mi · High 20.7 mi · Average risk 0.40 \(Low\)/),
    ).toBeInTheDocument()
  })

  it('describes the risk bar for assistive technology', () => {
    render(<RouteList plan={plan()} selectedId="route-1" onSelect={vi.fn()} />)
    expect(
      screen.getByRole('img', { name: /Miles by weather risk: Low 700 mi, Moderate 50 mi/ }),
    ).toBeInTheDocument()
  })

  it('marks the selected route and reports clicks', async () => {
    const onSelect = vi.fn()
    render(
      <RouteList
        plan={plan({ routes: [route(), stormy] })}
        selectedId="route-1"
        onSelect={onSelect}
      />,
    )
    const [first, second] = screen.getAllByRole('button')
    expect(first).toHaveAttribute('aria-pressed', 'true')
    expect(second).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(second as HTMLElement)
    expect(onSelect).toHaveBeenCalledWith('route-2')
  })

  it('shows a No Travel route with a critical alert and badge, never hidden', () => {
    render(
      <RouteList
        plan={plan({ routes: [route(), stormy] })}
        selectedId="route-1"
        onSelect={vi.fn()}
      />,
    )
    const card = screen.getByRole('button', { name: /route 2/i })
    expect(within(card).getByText('No Travel', { selector: '.badge' })).toBeInTheDocument()
    expect(within(card).getByRole('alert')).toHaveTextContent('NO TRAVEL - DO NOT DISPATCH')
    expect(within(card).getByText(/Severe weather over about 100 miles/)).toBeInTheDocument()
    expect(within(card).queryByText('Recommended')).not.toBeInTheDocument()
  })

  it('warns loudly when no route is safe', () => {
    const blocked = route({ has_no_travel: true })
    render(
      <RouteList
        plan={plan({ routes: [blocked], recommended_is_safe: false })}
        selectedId="route-1"
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/No safe route.*Do not dispatch/)
  })

  it('says when fewer than three routes were available', () => {
    render(<RouteList plan={plan()} selectedId="route-1" onSelect={vi.fn()} />)
    expect(screen.getByText('Only 1 route was available for this trip.')).toBeInTheDocument()
  })

  it('does not say so when three routes were found', () => {
    const three = plan({
      routes: [route(), route({ route_id: 'route-2' }), route({ route_id: 'route-3' })],
    })
    render(<RouteList plan={three} selectedId="route-1" onSelect={vi.fn()} />)
    expect(screen.queryByText(/available for this trip/)).not.toBeInTheDocument()
  })

  it('moves focus to the results when a plan arrives', () => {
    render(<RouteList plan={plan()} selectedId="route-1" onSelect={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /safest first/ })).toHaveFocus()
  })

  it("lists the selected route's checkpoints in a table", () => {
    render(
      <RouteList
        plan={plan({ routes: [route(), stormy] })}
        selectedId="route-2"
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByText('Route 2 checkpoints (2)')).toBeInTheDocument()
  })

  it('uses the singular for one route', () => {
    render(<RouteList plan={plan()} selectedId="route-1" onSelect={vi.fn()} />)
    expect(screen.getByRole('heading', { name: '1 route, safest first' })).toBeInTheDocument()
  })
})
