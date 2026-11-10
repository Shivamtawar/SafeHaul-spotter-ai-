import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { renderWithQuery } from '../../test/render'
import { PlannerPage } from './PlannerPage'

vi.mock('../map/MapView', () => ({
  MapView: () => {
    throw new Error('map exploded')
  },
}))

describe('PlannerPage when the map fails', () => {
  afterEach(() => vi.restoreAllMocks())

  it('keeps the form usable and says what happened', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderWithQuery(
      <MemoryRouter>
        <PlannerPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/The map could not be displayed/)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'From' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /find the safest route/i })).toBeInTheDocument()
  })
})
