/**
 * ErrorBoundary — generic safety net.
 *
 * Wrap any subtree that depends on remote-shape data (chat messages,
 * tool-call envelopes, JSON metadata) so a single bad row can't blank
 * the whole page. Renders a small inline card with the error message
 * and a "try again" CTA that resets the boundary.
 *
 * NOTE: this is intentionally minimal. The catch shows a useful card
 * to the user instead of a white screen, and forwards the error to
 * console.error so dev still sees it. We don't ship a global handler
 * here — call sites pick the right granularity (thread shell, page
 * shell, etc.).
 */
import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  /** What this boundary protects — used in the fallback message. */
  label?: string
  /** Optional custom fallback renderer. Receives the error + a reset fn. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', this.props.label ?? '(unlabeled)', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)
    return (
      <div className="m-6 max-w-lg rounded-xl border border-amber-200 bg-amber-50/60 p-5" role="alert">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-700" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900">
              Something went wrong{this.props.label ? ` rendering ${this.props.label}` : ''}
            </h3>
            <p className="mt-1 text-[12.5px] text-gray-700 leading-snug">
              The page caught an error before it could blank. You can retry, or
              navigate elsewhere and come back.
            </p>
            <pre className="mt-2 text-[11px] text-amber-900 bg-white/60 border border-amber-200 rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap">
              {error.message.slice(0, 600)}
            </pre>
            <button
              type="button"
              onClick={this.reset}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-300 bg-white text-[12px] font-medium text-amber-900 hover:bg-amber-100"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }
}
