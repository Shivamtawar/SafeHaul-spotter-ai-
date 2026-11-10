import type { Heatmap } from '../../shared/api/schemas'
import { formatDateTime } from '../../shared/lib/format'
import { RiskChip } from '../routes/RiskChip'
import { FORECAST_HOURS, forecastTime } from './heat'

interface TimeSliderProps {
  heatmap: Heatmap
  hour: number
  playing: boolean
  onHourChange: (hour: number) => void
  onTogglePlay: () => void
  showHeatmap: boolean
  onToggleHeatmap: (show: boolean) => void
  worstLevel: number
}

export function TimeSlider({
  heatmap,
  hour,
  playing,
  onHourChange,
  onTogglePlay,
  showHeatmap,
  onToggleHeatmap,
  worstLevel,
}: TimeSliderProps) {
  const when = formatDateTime(forecastTime(heatmap, hour).toISOString())
  const offset = hour === 0 ? 'at departure' : `+${hour} h`
  const max = Math.min(FORECAST_HOURS, heatmap.hours - 1)

  return (
    <div className="time-slider">
      <div className="time-slider-top">
        <button
          type="button"
          className="play"
          onClick={onTogglePlay}
          aria-label={playing ? 'Pause forecast animation' : 'Play forecast animation'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <label className="time-slider-label" htmlFor="forecast-hour">
          Forecast: <strong>{offset}</strong> <span>{when}</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={showHeatmap}
            onChange={(event) => onToggleHeatmap(event.target.checked)}
          />
          Heatmap
        </label>
      </div>
      <input
        id="forecast-hour"
        type="range"
        min={0}
        max={max}
        step={1}
        value={hour}
        onChange={(event) => onHourChange(Number(event.target.value))}
        aria-valuetext={`${offset}, ${when}`}
        style={{ '--pct': `${max > 0 ? (hour / max) * 100 : 0}%` } as React.CSSProperties}
      />
      <p className="time-slider-worst" aria-live="polite">
        Worst weather along the routes at this hour: <RiskChip level={worstLevel} />
      </p>
      <div className="time-slider-scale" aria-hidden="true">
        <span>Departure</span>
        <span>+{Math.round(max / 2)} h</span>
        <span>+{max} h</span>
      </div>
    </div>
  )
}
