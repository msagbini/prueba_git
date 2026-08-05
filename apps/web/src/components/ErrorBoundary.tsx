import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureException } from '../observability/sentry';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches rendering errors anywhere in the subtree and shows a recovery
 * screen instead of leaving the caller on a blank page — React error
 * boundaries only work as class components (`componentDidCatch`/
 * `getDerivedStateFromError` have no hook equivalent).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  /**
   * Derives the next render's state from a thrown error.
   * @param error the error thrown by a descendant during render
   * @returns the state update that switches this boundary into its fallback UI
   */
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  /**
   * Records the error once React has already captured the component stack.
   * @param error the error thrown by a descendant during render
   * @param info the component stack the error was thrown from
   */
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error:', error, info.componentStack);
    captureException(error, info.componentStack ?? undefined);
  }

  /**
   * Renders the fallback screen if a descendant has thrown, otherwise the normal subtree.
   * @returns the fallback UI or `this.props.children`
   */
  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-xl font-semibold text-gray-900">Something went wrong</h1>
          <p className="max-w-md text-sm text-gray-600">
            An unexpected error occurred. Try reloading the page — if it keeps happening, contact
            support.
          </p>
          <Button type="button" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
