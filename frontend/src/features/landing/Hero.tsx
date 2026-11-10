import { ArrowRight, MapPin, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SAMPLE_TRIPS } from '../../shared/trips/sampleTrips'
import { HeroMap } from './HeroMap'

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-inner">
        <div className="hero-copy">
          <p className="eyebrow hero-rise" style={{ '--i': 0 } as React.CSSProperties}>
            Weather-aware truck routing
          </p>
          <h1 id="hero-title" className="hero-title">
            <span className="hero-rise" style={{ '--i': 1 } as React.CSSProperties}>
              Plan the route.
            </span>
            <span className="hero-rise" style={{ '--i': 2 } as React.CSSProperties}>
              Beat the storm.
            </span>
            <span className="hero-rise accent" style={{ '--i': 3 } as React.CSSProperties}>
              Arrive safe.
            </span>
          </h1>
          <p className="hero-lead hero-rise" style={{ '--i': 4 } as React.CSSProperties}>
            SafeHaul compares up to three truck routes against the weather your truck will actually
            meet, checked at every checkpoint, at the time you will be there, for your load.
          </p>

          <Link
            to="/plan"
            className="hero-bar hero-rise"
            style={{ '--i': 5 } as React.CSSProperties}
          >
            <span className="hero-bar-field">
              <Search aria-hidden="true" />
              Try “Dallas to Denver, 45,000 lb”
            </span>
            <span className="btn btn-dark">
              Plan a route
              <ArrowRight className="arrow" aria-hidden="true" />
            </span>
          </Link>

          <div className="hero-popular hero-rise" style={{ '--i': 6 } as React.CSSProperties}>
            <span>Popular:</span>
            {SAMPLE_TRIPS.slice(0, 3).map((trip) => (
              <Link key={trip.id} className="chip" to={`/plan?trip=${trip.id}`}>
                <MapPin aria-hidden="true" />
                {trip.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="hero-visual hero-rise" style={{ '--i': 3 } as React.CSSProperties}>
          <HeroMap />
        </div>
      </div>
    </section>
  )
}
