import { Link } from 'react-router-dom'
import { Logo } from '../../shared/ui/Logo'

const CREDITS = [
  { name: 'Open-Meteo', href: 'https://open-meteo.com/' },
  { name: 'OpenRouteService', href: 'https://openrouteservice.org/' },
  { name: 'OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
  { name: 'Valhalla', href: 'https://valhalla.github.io/valhalla/' },
]

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <Logo />
          <p>Weather-aware routing for trucks. Free, open and built to be read.</p>
        </div>
        <nav aria-label="Footer">
          <h2 className="footer-heading">Product</h2>
          <ul>
            <li>
              <Link to="/plan">Plan a route</Link>
            </li>
            <li>
              <a href="#how">How it works</a>
            </li>
            <li>
              <a href="#risk">Risk scoring</a>
            </li>
            <li>
              <a href="#faq">FAQ</a>
            </li>
          </ul>
        </nav>
        <div>
          <h2 className="footer-heading">Data and maps</h2>
          <ul>
            {CREDITS.map((credit) => (
              <li key={credit.name}>
                <a href={credit.href} target="_blank" rel="noreferrer">
                  {credit.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="footer-note">
        SafeHaul is a decision aid. Always follow official road and weather advisories.
      </p>
    </footer>
  )
}
