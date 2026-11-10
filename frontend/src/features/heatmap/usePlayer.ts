import { useCallback, useEffect, useState } from 'react'
import { FORECAST_HOURS, advanceHour, clampHour } from './heat'

/** The forecast hour shown on the heatmap, with play/pause that steps through the hours. */
export function usePlayer(max: number = FORECAST_HOURS, intervalMs = 500) {
  const [hour, setHourRaw] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setHourRaw((current) => advanceHour(current, max)), intervalMs)
    return () => clearInterval(id)
  }, [playing, max, intervalMs])

  const setHour = useCallback((value: number) => setHourRaw(clampHour(value, max)), [max])
  const toggle = useCallback(() => setPlaying((value) => !value), [])
  const reset = useCallback(() => {
    setPlaying(false)
    setHourRaw(0)
  }, [])

  return { hour, playing, setHour, toggle, reset }
}
