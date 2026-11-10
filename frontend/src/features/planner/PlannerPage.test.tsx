import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ApiError } from '../../shared/api/client'
import { plan, route } from '../../test/fixtures'
import { renderWithQuery } from '../../test/render'
import { PlannerPage } from './PlannerPage'

const { planTrip } = vi.hoisted(() => ({ planTrip: vi.fn() }))

vi.mock('../../shared/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/api/client')>()),
  planTrip,
  searchPlaces: vi.fn(async (query: string) => [{ name: `${query} City`, lat: 33, lon: -97 }]),
}))

// Leaflet needs a real layout engine; the map is exercised in the browser, not in jsdom.
vi.mock('../map/MapView', () => ({
  MapView: ({
    selectedId,
    heatPoints,
    showHeatmap,
  }: {
    selectedId: string | null
    heatPoints: unknown[]
    showHeatmap: boolean
  }) => (
    <div data-testid="map">
      selected: {selectedId ?? 'none'} heat: {showHeatmap ? heatPoints.length : 'off'}
    </div>
  ),
}))

function renderPlanner(initialPath = '/plan') {
  return renderWithQuery(
    <MemoryRouter initialEntries={[initialPath]}>
      <PlannerPage />
    </MemoryRouter>,
  )
}

async function submit() {
  const user = userEvent.setup()
  for (const [label, text] of [
    ['From', 'Dallas'],
    ['To', 'Denver'],
  ] as const) {
    await user.type(screen.getByRole('combobox', { name: label }), text)
    await user.click(await screen.findByRole('option', { name: `${text} City` }))
  }
  await user.click(screen.getByRole('button', { name: /find the safest route/i }))
  return user
}

describe('PlannerPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('scrubs the forecast without any further requests', async () => {
    planTrip.mockResolvedValue(plan())
    renderPlanner()
    const user = await submit()
    const slider = await screen.findByRole('slider', { name: /forecast/i })
    const callsAfterPlan = planTrip.mock.calls.length
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    fireEvent.change(slider, { target: { value: '24' } })
    expect(slider).toHaveValue('24')
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringContaining('+24 h'))
    await user.click(screen.getByRole('checkbox', { name: 'Heatmap' }))
    expect(await screen.findByTestId('map')).toHaveTextContent('heat: off')

    expect(planTrip.mock.calls.length).toBe(callsAfterPlan)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns the slider to departure when a new trip is planned', async () => {
    planTrip.mockResolvedValue(plan())
    renderPlanner()
    const user = await submit()
    const slider = await screen.findByRole('slider', { name: /forecast/i })
    fireEvent.change(slider, { target: { value: '30' } })
    await user.click(screen.getByRole('button', { name: /find the safest route/i }))
    await vi.waitFor(() => expect(screen.getByRole('slider')).toHaveValue('0'))
  })

  it('hands the map the heat points for the current hour', async () => {
    planTrip.mockResolvedValue(plan())
    renderPlanner()
    await submit()
    expect(await screen.findByTestId('map')).toHaveTextContent('heat: 1')
  })

  it('fills in a sample trip chosen from the empty state', async () => {
    renderPlanner()
    await userEvent.click(screen.getByRole('button', { name: 'Chicago → Atlanta' }))
    expect(screen.getByRole('combobox', { name: 'From' })).toHaveValue('Chicago, IL, USA')
    expect(screen.getByRole('combobox', { name: 'To' })).toHaveValue('Atlanta, GA, USA')
  })

  it('opens with a sample trip when the link asks for one', () => {
    renderPlanner('/plan?trip=dallas-denver')
    expect(screen.getByRole('combobox', { name: 'From' })).toHaveValue('Dallas, TX, USA')
    expect(screen.getByRole('combobox', { name: 'To' })).toHaveValue('Denver, CO, USA')
  })

  it('ignores an unknown sample trip in the link', () => {
    renderPlanner('/plan?trip=nowhere')
    expect(screen.getByRole('combobox', { name: 'From' })).toHaveValue('')
  })

  it('explains what to do before a trip is planned', () => {
    renderPlanner()
    expect(screen.getByText(/Enter a trip to compare up to three truck routes/)).toBeInTheDocument()
  })

  it('offers retry after a failure and plans again with the same trip', async () => {
    planTrip.mockRejectedValueOnce(
      new ApiError('upstream_unavailable', 'Weather service is down.', 502),
    )
    planTrip.mockResolvedValueOnce(plan())
    renderPlanner()
    const user = await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Weather service is down.')
    const firstRequest = planTrip.mock.calls[0]?.[0]

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('heading', { name: '1 route, safest first' }),
    ).toBeInTheDocument()
    expect(planTrip.mock.calls[1]?.[0]).toEqual(firstRequest)
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('shows loading placeholders, not the empty message, while planning', async () => {
    planTrip.mockReturnValue(new Promise(() => {}))
    const { container } = renderPlanner()
    await submit()
    await screen.findByText(/checking the weather along each one/i)
    expect(container.querySelectorAll('.skeleton-card')).toHaveLength(3)
    expect(screen.queryByText(/Enter a trip to compare/)).not.toBeInTheDocument()
  })

  it('warns on the map when the selected route has No Travel weather', async () => {
    planTrip.mockResolvedValue(
      plan({
        routes: [route(), route({ route_id: 'route-2', recommended: false, has_no_travel: true })],
      }),
    )
    renderPlanner()
    const user = await submit()
    await screen.findByRole('heading', { name: '2 routes, safest first' })
    expect(screen.queryByText(/NO TRAVEL on Route/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /route 2/i }))
    expect(screen.getByText(/NO TRAVEL on Route 2/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show the recommended route' }))
    expect(screen.queryByText(/NO TRAVEL on Route/)).not.toBeInTheDocument()
  })

  it('names the worst weather at the chosen forecast hour', async () => {
    const stormy = plan()
    stormy.heatmap.points[0] = {
      lat: 32.78,
      lon: -96.8,
      levels: Array.from({ length: 49 }, (_, hour) => (hour >= 20 ? 3 : 0)),
    }
    planTrip.mockResolvedValue(stormy)
    renderPlanner()
    await submit()
    const slider = await screen.findByRole('slider', { name: /forecast/i })
    expect(screen.getByText(/Worst weather along the routes/)).toHaveTextContent('Low')
    fireEvent.change(slider, { target: { value: '30' } })
    expect(screen.getByText(/Worst weather along the routes/)).toHaveTextContent('Severe')
  })

  it('starts with the form and an empty map', async () => {
    renderPlanner()
    expect(screen.getByRole('heading', { name: 'Plan your trip' })).toBeInTheDocument()
    expect(await screen.findByTestId('map')).toHaveTextContent('selected: none')
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /routes?, safest first/ })).not.toBeInTheDocument()
  })

  it('plans a trip and selects the recommended route', async () => {
    planTrip.mockResolvedValue(
      plan({
        recommended_route_id: 'route-2',
        routes: [
          route({ route_id: 'route-2' }),
          route({ route_id: 'route-1', recommended: false }),
        ],
      }),
    )
    renderPlanner()
    await submit()
    expect(
      await screen.findByRole('heading', { name: '2 routes, safest first' }),
    ).toBeInTheDocument()
    expect(await screen.findByTestId('map')).toHaveTextContent('selected: route-2')
    expect(planTrip.mock.calls[0]?.[0]).toMatchObject({ load_lbs: 40_000, interval_miles: 25 })
  })

  it('lets the user pick a different route', async () => {
    planTrip.mockResolvedValue(
      plan({ routes: [route(), route({ route_id: 'route-2', recommended: false })] }),
    )
    renderPlanner()
    const user = await submit()
    await screen.findByRole('heading', { name: '2 routes, safest first' })
    await user.click(screen.getByRole('button', { name: /route 2/i }))
    expect(await screen.findByTestId('map')).toHaveTextContent('selected: route-2')
  })

  it('shows a progress message while planning', async () => {
    planTrip.mockReturnValue(new Promise(() => {}))
    renderPlanner()
    await submit()
    expect(await screen.findByText(/checking the weather along each one/i)).toBeInTheDocument()
  })

  it('shows the server message when planning fails', async () => {
    planTrip.mockRejectedValue(
      new ApiError('no_route_found', 'No truck route could be found.', 404),
    )
    renderPlanner()
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('No truck route could be found.')
  })

  it('shows a generic message for unexpected failures', async () => {
    planTrip.mockRejectedValue(new Error('boom'))
    renderPlanner()
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
  })
})
