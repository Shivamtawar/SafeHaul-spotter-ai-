import { BadgeCheck, Clock3, Layers, OctagonAlert, Route as RouteIcon, Scale } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface Feature {
  icon: LucideIcon
  title: string
  body: string
}

export const FEATURES: readonly Feature[] = [
  {
    icon: Clock3,
    title: 'Weather at your arrival time',
    body: 'Every checkpoint is checked for the hour the truck will actually be there, not the hour you leave.',
  },
  {
    icon: Scale,
    title: 'Rules that know your load',
    body: 'Heavy loads feel crosswind sooner. 35–44 mph is Severe above 40,000 lb, and No Travel at 45 mph over 30,000 lb.',
  },
  {
    icon: RouteIcon,
    title: 'Up to three truck routes',
    body: 'Truck-profile routes compared side by side on distance, drive time and the weather along each one.',
  },
  {
    icon: Layers,
    title: 'A 48-hour weather heatmap',
    body: 'Scrub the forecast and watch risk build and clear along the whole corridor, with no waiting.',
  },
  {
    icon: OctagonAlert,
    title: 'No Travel is impossible to miss',
    body: 'Unsafe routes stay visible but are flagged, dashed and ranked last, with a clear do-not-dispatch warning.',
  },
  {
    icon: BadgeCheck,
    title: 'Open data, no sign-up',
    body: 'Built on Open-Meteo, OpenStreetMap and OpenRouteService. Nothing to install, nothing to pay for.',
  },
]

export interface Step {
  title: string
  body: string
}

export const STEPS: readonly Step[] = [
  {
    title: 'Enter your trip',
    body: 'Where from, where to, when you leave and what you are hauling.',
  },
  {
    title: 'We read the weather',
    body: 'Checkpoints every 10, 25 or 50 miles, each checked for wind, rain and snow at its own arrival time.',
  },
  {
    title: 'Pick the safest route',
    body: 'Routes are ranked by Severe miles, then High miles, then average risk, then time.',
  },
]

export interface Band {
  label: string
  range: string
  color: string
}

export interface Condition {
  name: string
  unit: string
  bands: readonly Band[]
}

// The thresholds from the assessment brief; the backend enforces the same values.
export const CONDITIONS: readonly Condition[] = [
  {
    name: 'Wind',
    unit: 'mph',
    bands: [
      { label: 'Low', range: '< 25', color: 'var(--risk-low)' },
      { label: 'Moderate', range: '25–34', color: 'var(--risk-moderate)' },
      { label: 'High', range: '35–44', color: 'var(--risk-high)' },
      { label: 'Severe', range: '45–54', color: 'var(--risk-severe)' },
      { label: 'No Travel', range: '≥ 55', color: 'var(--risk-no-travel)' },
    ],
  },
  {
    name: 'Rain',
    unit: 'in/hr',
    bands: [
      { label: 'Low', range: '< 0.10', color: 'var(--risk-low)' },
      { label: 'Moderate', range: '0.10–0.25', color: 'var(--risk-moderate)' },
      { label: 'High', range: '0.25–0.50', color: 'var(--risk-high)' },
      { label: 'Severe', range: '0.50–1.00', color: 'var(--risk-severe)' },
      { label: 'No Travel', range: '> 1.00', color: 'var(--risk-no-travel)' },
    ],
  },
  {
    name: 'Snow',
    unit: 'in/hr',
    bands: [
      { label: 'Low', range: '< 0.5', color: 'var(--risk-low)' },
      { label: 'Moderate', range: '0.5–1.0', color: 'var(--risk-moderate)' },
      { label: 'High', range: '1.0–2.0', color: 'var(--risk-high)' },
      { label: 'Severe', range: '2.0–3.0', color: 'var(--risk-severe)' },
      { label: 'No Travel', range: '> 3.0', color: 'var(--risk-no-travel)' },
    ],
  },
]

export interface LoadRule {
  condition: string
  outcome: string
  tone: 'no-travel' | 'severe'
}

export const LOAD_RULES: readonly LoadRule[] = [
  { condition: 'Wind 55 mph or more', outcome: 'No Travel, for any load', tone: 'no-travel' },
  {
    condition: 'Wind 45–54 mph and over 30,000 lb',
    outcome: 'No Travel',
    tone: 'no-travel',
  },
  { condition: 'Wind 35–44 mph and over 40,000 lb', outcome: 'Severe', tone: 'severe' },
]

export const RANKING: readonly string[] = [
  'Fewest Severe miles',
  'Fewest High miles',
  'Lowest average risk',
  'Shortest travel time',
]

export interface Question {
  question: string
  answer: string
}

export const FAQ: readonly Question[] = [
  {
    question: 'Where does the weather come from?',
    answer:
      'Hourly forecasts from Open-Meteo, a free and open weather API. SafeHaul reads wind speed, rain and snowfall for each checkpoint at the hour the truck is expected to reach it.',
  },
  {
    question: 'How are the three routes found?',
    answer:
      'Truck-profile routing from OpenRouteService on OpenStreetMap data, with Valhalla supplying alternatives on longer trips where the primary service offers only one. Routes that are really the same road are merged, so some trips show fewer than three.',
  },
  {
    question: 'What does No Travel mean?',
    answer:
      'At least one checkpoint on that route meets a No Travel condition: wind of 55 mph or more, extreme rain or snow, or a heavy load in 45 mph wind. The route stays on the map so you can see why, but it is flagged, ranked last and never recommended unless every route is affected.',
  },
  {
    question: 'How far ahead can I plan?',
    answer:
      'Forecasts reach about 15 days out. The heatmap always shows the 48 hours after your departure, so very late departures are asked to move earlier.',
  },
  {
    question: 'Does my load really change the result?',
    answer:
      'Yes. A 40 mph crosswind is High risk for a light truck but Severe above 40,000 lb. Change the load weight and the routes are re-scored.',
  },
  {
    question: 'Is it free? Can I rely on it?',
    answer:
      'It is free and uses open data. It is a decision aid, not a replacement for official road and weather advisories or your own judgment. Always follow the authorities.',
  },
]
