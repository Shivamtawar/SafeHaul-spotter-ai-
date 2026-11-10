import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useScrolled } from '../lib/useScroll'
import { Logo } from './Logo'

interface SiteNavProps {
  variant: 'landing' | 'app'
}

/** The floating pill navigation. On the landing page it shrinks once the page scrolls. */
export function SiteNav({ variant }: SiteNavProps) {
  const scrolled = useScrolled()

  return (
    <header
      className="site-nav"
      data-variant={variant}
      data-scrolled={variant === 'landing' ? scrolled : false}
    >
      <nav className="site-nav-bar" aria-label="Main">
        <Link to="/" aria-label="SafeHaul home">
          <Logo />
        </Link>
        <div className="site-nav-links">
          {variant === 'landing' ? (
            <>
              <a className="collapsible" href="#how">
                How it works
              </a>
              <a className="collapsible" href="#risk">
                Risk scoring
              </a>
              <a className="collapsible" href="#faq">
                FAQ
              </a>
            </>
          ) : (
            <Link className="collapsible" to="/">
              Home
            </Link>
          )}
          {variant === 'landing' && (
            <Link className="btn btn-dark" to="/plan">
              Plan a route
              <ArrowRight className="arrow" aria-hidden="true" />
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
