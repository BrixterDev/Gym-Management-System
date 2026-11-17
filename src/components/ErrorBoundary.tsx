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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-rose-600">
          Something went wrong
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">The app hit an unexpected error</h1>
        <p className="max-w-sm text-sm text-slate-500">
          Your data is safe. Reload the page to continue, or contact the gym administrator if the
          problem persists.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
        >
          Reload app
        </button>
      </div>
    )
  }
}
