import { Gauge, Route as RouteIcon, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { STEPS } from './content'
import { Reveal } from './Reveal'

const ICONS = [Search, Gauge, RouteIcon]

/** Three steps on a vertical timeline that fills in as the reader scrolls. */
export function Steps() {
  const section = useRef<HTMLOListElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const element = section.current
      if (!element) return
      const rect = element.getBoundingClientRect()
      const anchor = window.innerHeight * 0.55
      const covered = (anchor - rect.top) / rect.height
      setProgress(Math.min(Math.max(covered, 0), 1))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const active = Math.min(Math.floor(progress * STEPS.length * 0.999 + 0.15), STEPS.length - 1)

  return (
    <section className="section steps" id="how" aria-labelledby="how-title">
      <Reveal className="section-head">
        <p className="eyebrow">How it works</p>
        <h2 id="how-title">Three steps. One safer trip.</h2>
      </Reveal>
      <ol className="timeline" ref={section} style={{ '--fill': progress } as React.CSSProperties}>
        <span className="timeline-line" aria-hidden="true" />
        {STEPS.map((step, index) => {
          const Icon = ICONS[index] ?? Search
          return (
            <li key={step.title} className="timeline-step" data-active={index <= active}>
              <span className="timeline-node" aria-hidden="true">
                <Icon />
              </span>
              <div className="timeline-copy">
                <span className="timeline-number">0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
