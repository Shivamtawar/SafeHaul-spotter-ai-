import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithQuery } from '../test/render'
import { App } from './App'

vi.mock('../features/map/MapView', () => ({ MapView: () => <div data-testid="map" /> }))

function renderAt(path: string) {
  return renderWithQuery(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('routing', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the landing page at the root', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Arrive safe/)
  })

  it('shows the planner at /plan', () => {
    renderAt('/plan')
    expect(screen.getByRole('heading', { name: 'Plan your trip' })).toBeInTheDocument()
  })

  it('shows a way home for unknown pages', () => {
    render(
      <MemoryRouter initialEntries={['/nope']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to SafeHaul' })).toHaveAttribute('href', '/')
  })
})
