import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { plan } from '../../test/fixtures'
import { TimeSlider } from './TimeSlider'

function setup(overrides: Partial<Parameters<typeof TimeSlider>[0]> = {}) {
  const props = {
    heatmap: plan().heatmap,
    hour: 0,
    playing: false,
    onHourChange: vi.fn(),
    onTogglePlay: vi.fn(),
    showHeatmap: true,
    onToggleHeatmap: vi.fn(),
    worstLevel: 0,
    ...overrides,
  }
  render(<TimeSlider {...props} />)
  return props
}

describe('TimeSlider', () => {
  it('spans 0 to 48 hours', () => {
    setup()
    const slider = screen.getByRole('slider', { name: /forecast/i })
    expect(slider).toHaveAttribute('min', '0')
    expect(slider).toHaveAttribute('max', '48')
    expect(slider).toHaveValue('0')
  })

  it('labels the hour relative to departure and gives the clock time', () => {
    setup({ hour: 12 })
    expect(screen.getByText('+12 h')).toBeInTheDocument()
    expect(screen.getByRole('slider')).toHaveAttribute(
      'aria-valuetext',
      expect.stringContaining('+12 h'),
    )
  })

  it('says "at departure" at hour 0', () => {
    setup({ hour: 0 })
    expect(screen.getByText('at departure')).toBeInTheDocument()
  })

  it('reports the hour as the user drags', () => {
    const props = setup()
    fireEvent.change(screen.getByRole('slider'), { target: { value: '30' } })
    expect(props.onHourChange).toHaveBeenCalledWith(30)
  })

  it('offers play, then pause while playing', async () => {
    const stopped = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Play forecast animation' }))
    expect(stopped.onTogglePlay).toHaveBeenCalledTimes(1)
  })

  it('shows the pause button while playing', () => {
    setup({ playing: true })
    expect(screen.getByRole('button', { name: 'Pause forecast animation' })).toBeInTheDocument()
  })

  it('toggles the heatmap', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Heatmap' }))
    expect(props.onToggleHeatmap).toHaveBeenCalledWith(false)
  })

  it('announces the worst weather at the chosen hour, in words', () => {
    setup({ worstLevel: 3 })
    expect(screen.getByText(/Worst weather along the routes at this hour/)).toHaveTextContent(
      'Severe',
    )
  })

  it('shortens the range when the forecast has fewer hours', () => {
    setup({ heatmap: { ...plan().heatmap, hours: 25 } })
    expect(screen.getByRole('slider')).toHaveAttribute('max', '24')
  })
})
