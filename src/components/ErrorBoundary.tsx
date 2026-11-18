import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled application error', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ink-950 px-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-rose-400">
          Something went wrong
        </p>
        <h1 className="text-2xl font-semibold text-slate-100">The app hit an unexpected error</h1>
        <p className="max-w-sm text-sm text-slate-400">
          Your data is safe. Reload the page to continue, or contact the gym administrator if the
          problem persists.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 inline-flex h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-500"
        >
          Reload app
        </button>
      </div>
    )
  }
}
