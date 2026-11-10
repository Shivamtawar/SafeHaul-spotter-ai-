import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithQuery } from '../../test/render'
import { TripForm } from './TripForm'

vi.mock('../../shared/api/client', () => ({
  searchPlaces: vi.fn(async (query: string) =>
    query.toLowerCase().startsWith('dal')
      ? [
          { name: 'Dallas, TX, USA', lat: 32.78, lon: -96.8 },
          { name: 'Dallas, GA, USA', lat: 33.9, lon: -84.8 },
        ]
      : query.toLowerCase().startsWith('den')
        ? [{ name: 'Denver, CO, USA', lat: 39.74, lon: -104.99 }]
        : [],
  ),
}))

const DALLAS = { name: 'Dallas, TX, USA', lat: 32.78, lon: -96.8 }
const DENVER = { name: 'Denver, CO, USA', lat: 39.74, lon: -104.99 }

async function pick(label: string, text: string, option: string) {
  const user = userEvent.setup()
  await user.type(screen.getByRole('combobox', { name: label }), text)
  await user.click(await screen.findByRole('option', { name: option }))
}

function setup(props: { isPending?: boolean } = {}) {
  const onSubmit = vi.fn()
  renderWithQuery(
    <TripForm onSubmit={onSubmit} isPending={props.isPending ?? false} debounceMs={0} />,
  )
  return { onSubmit, user: userEvent.setup() }
}

describe('TripForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks for both places before submitting', async () => {
    const { onSubmit, user } = setup()
    await user.click(screen.getByRole('button', { name: /find the safest route/i }))
    expect(screen.getByText('Choose a starting place from the list.')).toBeInTheDocument()
    expect(screen.getByText('Choose a destination from the list.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the chosen places, departure, load and interval', async () => {
    const { onSubmit, user } = setup()
    await pick('From', 'Dal', 'Dallas, TX, USA')
    await pick('To', 'Den', 'Denver, CO, USA')
    await user.clear(screen.getByLabelText('Load weight (lb)'))
    await user.type(screen.getByLabelText('Load weight (lb)'), '52000')
    await user.click(screen.getByRole('radio', { name: '50 mi' }))
    await user.click(screen.getByRole('button', { name: /find the safest route/i }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const request = onSubmit.mock.calls[0]?.[0]
    expect(request).toMatchObject({
      origin: DALLAS,
      destination: DENVER,
      load_lbs: 52_000,
      interval_miles: 50,
    })
    expect(request.departure).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('defaults the checkpoint interval to 25 miles', () => {
    setup()
    expect(screen.getByRole('radio', { name: '25 mi' })).toBeChecked()
  })

  it('chooses a suggestion with the keyboard', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByRole('combobox', { name: 'From' }), 'Dal')
    await screen.findByRole('option', { name: 'Dallas, GA, USA' })
    await user.keyboard('{ArrowDown}{Enter}')
    expect(screen.getByRole('combobox', { name: 'From' })).toHaveValue('Dallas, GA, USA')
    expect(onSubmit).not.toHaveBeenCalled() // Enter chose a place; it did not submit the form
  })

  it('closes the suggestions with Escape', async () => {
    const { user } = setup()
    await user.type(screen.getByRole('combobox', { name: 'From' }), 'Dal')
    await screen.findByRole('listbox')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('wraps around the suggestions with ArrowUp', async () => {
    const { user } = setup()
    await user.type(screen.getByRole('combobox', { name: 'From' }), 'Dal')
    await screen.findByRole('option', { name: 'Dallas, TX, USA' })
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('option', { name: 'Dallas, GA, USA' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('says when nothing matches', async () => {
    const { user } = setup()
    await user.type(screen.getByRole('combobox', { name: 'From' }), 'zzzz')
    expect(await screen.findByText('No places found.')).toBeInTheDocument()
  })

  it('does not search until three characters are typed', async () => {
    const { user } = setup()
    await user.type(screen.getByRole('combobox', { name: 'From' }), 'Da')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('forgets the chosen place when the text is edited', async () => {
    const { onSubmit, user } = setup()
    await pick('From', 'Dal', 'Dallas, TX, USA')
    await pick('To', 'Den', 'Denver, CO, USA')
    await user.type(screen.getByRole('combobox', { name: 'From' }), 'x')
    await user.click(screen.getByRole('button', { name: /find the safest route/i }))
    expect(screen.getByText('Choose a starting place from the list.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it.each(['0', '120001', '12.5', ''])('rejects a load of %j', async (value) => {
    const { onSubmit, user } = setup()
    await pick('From', 'Dal', 'Dallas, TX, USA')
    await pick('To', 'Den', 'Denver, CO, USA')
    const load = screen.getByLabelText('Load weight (lb)')
    await user.clear(load)
    if (value) await user.type(load, value)
    await user.click(screen.getByRole('button', { name: /find the safest route/i }))
    expect(await screen.findByText(/whole number of pounds/i)).toBeInTheDocument()
    expect(load).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects a cleared departure', async () => {
    const { onSubmit, user } = setup()
    await pick('From', 'Dal', 'Dallas, TX, USA')
    await pick('To', 'Den', 'Denver, CO, USA')
    await user.clear(screen.getByLabelText('Departure'))
    await user.click(screen.getByRole('button', { name: /find the safest route/i }))
    await waitFor(() =>
      expect(screen.getByText('Enter a departure date and time.')).toBeInTheDocument(),
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('disables the button while a plan is being computed', () => {
    setup({ isPending: true })
    expect(screen.getByRole('button', { name: /checking the weather/i })).toBeDisabled()
  })
})
