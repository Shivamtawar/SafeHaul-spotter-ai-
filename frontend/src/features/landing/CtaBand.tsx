import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Reveal } from './Reveal'

export function CtaBand() {
  return (
    <section className="cta-wrap" aria-labelledby="cta-title">
      <Reveal className="cta-band">
        <h2 id="cta-title">Check your next trip in under a minute.</h2>
        <p>
          Pick a route, set your load, and see where the weather will and will not let you through.
        </p>
        <Link to="/plan" className="btn btn-light">
          Plan a route
          <ArrowRight className="arrow" aria-hidden="true" />
        </Link>
      </Reveal>
    </section>
  )
}
