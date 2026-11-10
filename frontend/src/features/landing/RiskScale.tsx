import { CloudRain, Snowflake, Wind } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CONDITIONS, LOAD_RULES, RANKING } from './content'
import { Reveal } from './Reveal'

const ICONS: Record<string, LucideIcon> = { Wind, Rain: CloudRain, Snow: Snowflake }

export function RiskScale() {
  return (
    <section className="section risk" id="risk" aria-labelledby="risk-title">
      <Reveal className="section-head">
        <p className="eyebrow">Transparent scoring</p>
        <h2 id="risk-title">No black box. Here is every threshold.</h2>
        <p className="section-lead">
          Each checkpoint gets the worst of its wind, rain and snow levels, raised by your load.
        </p>
      </Reveal>

      <div className="risk-table">
        {CONDITIONS.map((condition, row) => {
          const Icon = ICONS[condition.name] ?? Wind
          return (
            <Reveal key={condition.name} className="risk-row" delay={row * 90}>
              <h3>
                <Icon aria-hidden="true" />
                {condition.name}
                <small>{condition.unit}</small>
              </h3>
              <ul className="risk-bands">
                {condition.bands.map((band) => (
                  <li key={band.label} style={{ '--band': band.color } as React.CSSProperties}>
                    <span className="band-label">{band.label}</span>
                    <span className="band-range">{band.range}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          )
        })}
      </div>

      <div className="risk-extras">
        <Reveal className="extra-card">
          <h3>Load rules</h3>
          <ul>
            {LOAD_RULES.map((rule) => (
              <li key={rule.condition} data-tone={rule.tone}>
                <span>{rule.condition}</span>
                <strong>{rule.outcome}</strong>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal className="extra-card" delay={100}>
          <h3>How we pick the route</h3>
          <ol>
            {RANKING.map((item, index) => (
              <li key={item}>
                <span className="rank-number">{index + 1}</span>
                {item}
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  )
}
