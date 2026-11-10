import { FEATURES } from './content'
import { Reveal } from './Reveal'

export function Features() {
  return (
    <section className="section" id="why" aria-labelledby="why-title">
      <Reveal className="section-head">
        <p className="eyebrow">Why SafeHaul</p>
        <h2 id="why-title">Weather decisions that fit your truck.</h2>
        <p className="section-lead">
          Most route tools stop at traffic. SafeHaul adds the part that closes roads and tips
          trailers.
        </p>
      </Reveal>
      <ul className="feature-grid">
        {FEATURES.map((feature, index) => (
          <Reveal as="li" key={feature.title} className="feature-card" delay={(index % 3) * 80}>
            <span className="feature-icon">
              <feature.icon aria-hidden="true" />
            </span>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </Reveal>
        ))}
      </ul>
    </section>
  )
}
