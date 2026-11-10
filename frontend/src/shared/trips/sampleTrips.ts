import type { Place } from '../api/schemas'

export interface SampleTrip {
  id: string
  label: string
  origin: Place
  destination: Place
}

/** Ready-made trips for the landing page and the empty planner, so a first visit takes one click. */
export const SAMPLE_TRIPS: readonly SampleTrip[] = [
  {
    id: 'dallas-denver',
    label: 'Dallas → Denver',
    origin: { name: 'Dallas, TX, USA', lat: 32.7767, lon: -96.797 },
    destination: { name: 'Denver, CO, USA', lat: 39.7392, lon: -104.9903 },
  },
  {
    id: 'chicago-atlanta',
    label: 'Chicago → Atlanta',
    origin: { name: 'Chicago, IL, USA', lat: 41.8781, lon: -87.6298 },
    destination: { name: 'Atlanta, GA, USA', lat: 33.749, lon: -84.388 },
  },
  {
    id: 'la-phoenix',
    label: 'Los Angeles → Phoenix',
    origin: { name: 'Los Angeles, CA, USA', lat: 34.0522, lon: -118.2437 },
    destination: { name: 'Phoenix, AZ, USA', lat: 33.4484, lon: -112.074 },
  },
  {
    id: 'seattle-slc',
    label: 'Seattle → Salt Lake City',
    origin: { name: 'Seattle, WA, USA', lat: 47.6062, lon: -122.3321 },
    destination: { name: 'Salt Lake City, UT, USA', lat: 40.7608, lon: -111.891 },
  },
]

export function findSampleTrip(id: string | null): SampleTrip | undefined {
  return SAMPLE_TRIPS.find((trip) => trip.id === id)
}
