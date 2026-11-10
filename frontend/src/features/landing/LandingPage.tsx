import './landing.css'
import { usePageProgress } from '../../shared/lib/useScroll'
import { SiteNav } from '../../shared/ui/SiteNav'
import { CtaBand } from './CtaBand'
import { DataStrip } from './DataStrip'
import { Faq } from './Faq'
import { Features } from './Features'
import { Footer } from './Footer'
import { ForecastDemo } from './ForecastDemo'
import { Hero } from './Hero'
import { RiskScale } from './RiskScale'
import { Steps } from './Steps'

export function LandingPage() {
  const progress = usePageProgress()

  return (
    <div className="landing">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div
        className="scroll-progress"
        aria-hidden="true"
        style={{ '--progress': progress } as React.CSSProperties}
      />
      <SiteNav variant="landing" />
      <main id="main">
        <Hero />
        <DataStrip />
        <Features />
        <ForecastDemo />
        <RiskScale />
        <Steps />
        <Faq />
        <CtaBand />
      </main>
      <Footer />
    </div>
  )
}
