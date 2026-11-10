import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { checkpoint, route } from '../../test/fixtures'
import { CheckpointTable } from './CheckpointTable'

const withCheckpoints = route({
  checkpoints: [
    checkpoint({ mile: 0 }),
    checkpoint({ mile: 25, level: 4, level_label: 'No Travel', wind_mph: 61, rain_in_hr: 0.3 }),
  ],
})

describe('CheckpointTable', () => {
  it('lists every checkpoint with its mile, weather and risk', () => {
    render(<CheckpointTable route={withCheckpoints} name="Route 2" />)
    expect(screen.getByText('Route 2 checkpoints (2)')).toBeInTheDocument()
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(3) // header + 2 checkpoints
    const blocked = within(rows[2] as HTMLElement)
    expect(blocked.getByRole('rowheader')).toHaveTextContent('25')
    expect(blocked.getByText('61 mph')).toBeInTheDocument()
    expect(blocked.getByText('0.3 in/hr')).toBeInTheDocument()
    expect(blocked.getByText(/No Travel/)).toBeInTheDocument()
  })

  it('has accessible column headers and a caption', () => {
    render(<CheckpointTable route={withCheckpoints} name="Route 2" />)
    for (const name of ['Mile', 'ETA', 'Risk', 'Wind', 'Rain', 'Snow']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    expect(
      screen.getByRole('table', { name: /Weather at each checkpoint on Route 2/ }),
    ).toBeInTheDocument()
  })
})
