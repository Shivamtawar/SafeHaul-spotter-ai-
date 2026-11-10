import { useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { LandingPage } from '../features/landing/LandingPage'
import { PlannerPage } from '../features/planner/PlannerPage'

/** Each page starts at the top, as a normal page load would. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function NotFound() {
  return (
    <main className="not-found">
      <h1>Page not found</h1>
      <p>That page does not exist.</p>
      <Link className="btn btn-dark" to="/">
        Back to SafeHaul
      </Link>
    </main>
  )
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/plan" element={<PlannerPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}
