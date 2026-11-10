import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface State {
  failed: boolean
}

/** Last line of defense: a crash in one part of the UI shows a message, not a blank page. */
interface Props {
  children: ReactNode
  /** Shown instead of the full-page message, to contain a failure to one part of the UI. */
  fallback?: ReactNode
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="fatal" role="alert">
          <h1>Something went wrong</h1>
          <p>Reload the page to try again.</p>
          <button type="button" className="primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
