import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RiskChip } from './RiskChip'
import { EmptyState, RouteSkeletons } from './RouteListStates'

describe('RouteListStates', () => {
  it('explains what to do before any trip is planned', () => {
    render(<EmptyState />)
    expect(screen.getByText(/Enter a trip to compare up to three truck routes/)).toBeInTheDocument()
  })

  it('hides the loading placeholders from assistive technology', () => {
    const { container } = render(<RouteSkeletons />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelectorAll('.skeleton-card')).toHaveLength(3)
  })
})

describe('RiskChip', () => {
  it.each([
    [0, 'Low'],
    [2, 'High'],
    [4, 'No Travel'],
  ])('shows level %i as text, not only color', (level, label) => {
    render(<RiskChip level={level} />)
    expect(screen.getByText(label, { exact: false })).toBeInTheDocument()
  })
})
