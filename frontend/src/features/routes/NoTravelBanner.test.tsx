import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { plan, route } from '../../test/fixtures'
import { NoTravelBanner } from './NoTravelBanner'

const safe = route({ route_id: 'route-1' })
const blocked = route({ route_id: 'route-2', recommended: false, has_no_travel: true })

describe('NoTravelBanner', () => {
  it('stays out of the way for a safe route', () => {
    const { container } = render(
      <NoTravelBanner
        plan={plan({ routes: [safe, blocked] })}
        selectedId="route-1"
        onSelect={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('is a loud alert when the selected route has No Travel weather', () => {
    render(
      <NoTravelBanner
        plan={plan({ routes: [safe, blocked] })}
        selectedId="route-2"
        onSelect={vi.fn()}
      />,
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('NO TRAVEL on Route 2')
    expect(alert).toHaveTextContent('Do not dispatch')
  })

  it('offers to switch to the recommended route', async () => {
    const onSelect = vi.fn()
    render(
      <NoTravelBanner
        plan={plan({ routes: [safe, blocked] })}
        selectedId="route-2"
        onSelect={onSelect}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Show the recommended route' }))
    expect(onSelect).toHaveBeenCalledWith('route-1')
  })

  it('suggests another departure time when every route is blocked', () => {
    const everyRouteBlocked = plan({
      routes: [route({ has_no_travel: true })],
      recommended_is_safe: false,
    })
    render(<NoTravelBanner plan={everyRouteBlocked} selectedId="route-1" onSelect={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Every route is affected')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders nothing for an unknown selection', () => {
    const { container } = render(
      <NoTravelBanner plan={plan()} selectedId="missing" onSelect={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
