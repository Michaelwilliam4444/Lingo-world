'use client';
import { Component, type ReactNode } from 'react';

/** Catches render errors; children see a friendly Mimo screen, never a stack trace. */
export class ErrorBoundary extends Component<{ fallback: (reset: () => void) => ReactNode; children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  override componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Logged without child data; production deployments forward this to their error tracker.
    console.error('[LingoWorld] UI error', error.message, info.componentStack?.split('\n').slice(0, 4).join('\n'));
  }
  override render() {
    if (this.state.error) return this.props.fallback(() => this.setState({ error: null }));
    return this.props.children;
  }
}
