import { Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { riskByLevel } from '../../shared/risk/tokens'
import { usePrefersReducedMotion } from '../../shared/lib/useReveal'
import { DEMO_HOURS, DEMO_ROUTES, demoRow, demoWorst } from './forecastModel'
import { Reveal } from './Reveal'

const ROWS = Array.from({ length: DEMO_ROUTES }, (_, route) => demoRow(route))
const TICK_MS = 380

/** An illustrative, auto-playing preview of the 48-hour forecast view. */
export function ForecastDemo() {
  const reduceMotion = usePrefersReducedMotion()
  const [hour, setHour] = useState(14)
  const [playing, setPlaying] = useState(!reduceMotion)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setHour((h) => (h >= DEMO_HOURS ? 0 : h + 1)), TICK_MS)
    return () => clearInterval(id)
  }, [playing])

  const worst = riskByLevel(demoWorst(hour))

  return (
    <section className="section demo" aria-labelledby="demo-title">
      <div className="demo-inner">
        <Reveal className="demo-copy">
          <p className="eyebrow">48-hour forecast view</p>
          <h2 id="demo-title">See the storm move across your routes.</h2>
          <p className="section-lead">
            Drag the forecast hour and the whole corridor re-colors instantly. Leave an hour
            earlier, an hour later, or pick the route the storm misses.
          </p>
          <ul className="check-list">
            <li>Every hour of the next 48 is pre-computed, so scrubbing is instant.</li>
            <li>Play it as an animation to watch fronts roll through.</li>
            <li>Compare all routes on one timeline.</li>
          </ul>
        </Reveal>

        <Reveal className="demo-card" delay={120}>
          <div className="demo-head">
            <button
              type="button"
              className="demo-play"
              onClick={() => setPlaying((value) => !value)}
              aria-label={playing ? 'Pause the example' : 'Play the example'}
            >
              {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </button>
            <p aria-live="off" data-testid="demo-readout">
              Forecast <strong>+{hour} h</strong>
            </p>
            <p className="demo-worst" style={{ '--tone': worst.color } as React.CSSProperties}>
              <span aria-hidden="true">{worst.icon}</span> {worst.label}
            </p>
          </div>

          <div
            className="demo-rows"
            role="img"
            aria-label="Example: risk for each of three routes over 48 hours, with a storm crossing route 2 first"
          >
            <div
              className="demo-playhead"
              style={{ '--hour': hour / DEMO_HOURS } as React.CSSProperties}
            />
            {ROWS.map((row, route) => (
              <div key={route} className="demo-row">
                <span className="demo-row-label">Route {route + 1}</span>
                <div className="demo-cells">
                  {row.map((level, cell) => (
                    <span
                      key={cell}
                      className="demo-cell"
                      style={{ background: riskByLevel(level).color, opacity: 0.35 + level * 0.16 }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="demo-note">Illustrative example, not live data.</p>
        </Reveal>
      </div>
    </section>
  )
}
