import { Component, type ReactNode } from 'react';
import { reportClientError } from '@/lib/errorReporter';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    reportClientError(error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
        <p className="max-w-sm text-sm text-slate-500">The error has been logged for the demo administrators. Please reload to continue.</p>
        <button className="mt-2 h-11 rounded-xl bg-brand-800 px-5 font-semibold text-white" onClick={() => window.location.assign('/')}>
          Reload app
        </button>
      </div>
    );
  }
}
