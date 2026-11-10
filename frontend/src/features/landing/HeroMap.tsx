import { CheckCircle2, Clock3, OctagonAlert } from 'lucide-react'
import { usePrefersReducedMotion } from '../../shared/lib/useReveal'
import { pathData, pointsAlong } from './bezier'
import type { Segment } from './bezier'

const START = [58, 356] as const
const END = [478, 84] as const

// Three illustrative routes between the same two points.
const ROUTE_ONE: Segment[] = [
  [START, [150, 312], [214, 262], [292, 236]],
  [[292, 236], [366, 212], [418, 140], END],
]
const ROUTE_TWO: Segment[] = [
  [START, [104, 214], [196, 176], [262, 160]],
  [[262, 160], [332, 142], [420, 52], END],
]
const ROUTE_THREE: Segment[] = [
  [START, [196, 390], [330, 350], [392, 262]],
  [[392, 262], [440, 196], [452, 130], END],
]

/** A stylised map for the hero: three routes, a storm over one, and a truck on the safe one. */
export function HeroMap() {
  const reduceMotion = usePrefersReducedMotion()
  const checkpointsOne = pointsAlong(ROUTE_ONE, 8)
  const checkpointsTwo = pointsAlong(ROUTE_TWO, 8)
  const checkpointsThree = pointsAlong(ROUTE_THREE, 7)

  return (
    <div
      className="hero-map"
      role="img"
      aria-label="Illustration: three routes, one crossing a storm cell and marked No Travel, one recommended"
    >
      <svg viewBox="0 0 540 440" className="hero-map-svg" aria-hidden="true">
        <defs>
          <radialGradient id="storm" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#7f1d1d" stopOpacity="0.85" />
            <stop offset="0.35" stopColor="#dc2626" stopOpacity="0.6" />
            <stop offset="0.7" stopColor="#ea580c" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ca8a04" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="calm" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#16a57a" stopOpacity="0.4" />
            <stop offset="1" stopColor="#16a57a" stopOpacity="0" />
          </radialGradient>
          <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0H0V28" fill="none" stroke="#e8e9f0" strokeWidth="1" />
          </pattern>
          <clipPath id="card-clip">
            <rect width="540" height="440" rx="28" />
          </clipPath>
        </defs>

        <g clipPath="url(#card-clip)">
          <rect width="540" height="440" fill="#fbfbfe" />
          <rect width="540" height="440" fill="url(#grid)" />
          <ellipse cx="420" cy="360" rx="160" ry="90" fill="#e3f1f2" opacity="0.7" />
          <ellipse cx="110" cy="90" rx="130" ry="70" fill="#f1f8f9" />

          <circle className="storm storm-a" cx="262" cy="168" r="96" fill="url(#storm)" />
          <circle className="storm storm-b" cx="336" cy="126" r="58" fill="url(#storm)" />
          <circle cx="330" cy="318" r="84" fill="url(#calm)" />

          <path d={pathData(ROUTE_THREE)} className="hero-route route-three" />
          <path d={pathData(ROUTE_TWO)} className="hero-route route-two" />
          <path id="hero-route-one" d={pathData(ROUTE_ONE)} className="hero-route route-one" />

          {checkpointsThree.map(([x, y], index) => (
            <circle key={`c3-${index}`} cx={x} cy={y} r="4" className="dot dot-low" />
          ))}
          {checkpointsTwo.map(([x, y], index) => (
            <circle
              key={`c2-${index}`}
              cx={x}
              cy={y}
              r={index >= 3 && index <= 5 ? 5.5 : 4}
              className={index >= 3 && index <= 5 ? 'dot dot-blocked' : 'dot dot-low'}
            />
          ))}
          {checkpointsOne.map(([x, y], index) => (
            <circle key={`c1-${index}`} cx={x} cy={y} r="4.5" className="dot dot-low" />
          ))}

          <circle cx={START[0]} cy={START[1]} r="9" fill="#fff" stroke="#081836" strokeWidth="3" />
          <circle cx={END[0]} cy={END[1]} r="9" fill="#081836" stroke="#fff" strokeWidth="3" />

          {!reduceMotion && (
            <g>
              <circle r="9" fill="#158280" opacity="0.25">
                <animateMotion dur="9s" repeatCount="indefinite" rotate="auto">
                  <mpath href="#hero-route-one" />
                </animateMotion>
              </circle>
              <circle r="5.5" fill="#158280" stroke="#fff" strokeWidth="2">
                <animateMotion dur="9s" repeatCount="indefinite" rotate="auto">
                  <mpath href="#hero-route-one" />
                </animateMotion>
              </circle>
            </g>
          )}
        </g>
      </svg>

      <div className="hero-card hero-card-safe">
        <CheckCircle2 aria-hidden="true" />
        <div>
          <strong>Route 1 · Recommended</strong>
          <span>13h 21m · Low risk all the way</span>
        </div>
      </div>
      <div className="hero-card hero-card-danger">
        <OctagonAlert aria-hidden="true" />
        <div>
          <strong>Route 2 · No Travel</strong>
          <span>61 mph wind near mile 300</span>
        </div>
      </div>
      <div className="hero-card hero-card-time">
        <Clock3 aria-hidden="true" />
        <span>Forecast +18 h</span>
      </div>
    </div>
  )
}
