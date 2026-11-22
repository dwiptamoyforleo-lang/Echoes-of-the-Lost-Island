import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  SAVE_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
} from '@/src/systems/saveSystem';

interface AppErrorBoundaryProps {
  children: ReactNode;
  scope?: 'root' | 'canvas';
  attachGlobalListeners?: boolean;
}

interface AppErrorBoundaryState {
  error: Error | null;
  errorSource: string | null;
}

function normalizeError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === 'string') return new Error(err);
  try {
    return new Error(JSON.stringify(err));
  } catch {
    return new Error(String(err));
  }
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    error: null,
    errorSource: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error, errorSource: 'React Render Error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Echoes] Uncaught UI/3D boundary error:', error, info.componentStack);
  }

  componentDidMount(): void {
    if (!this.props.attachGlobalListeners || typeof window === 'undefined') {
      return;
    }
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount(): void {
    if (!this.props.attachGlobalListeners || typeof window === 'undefined') {
      return;
    }
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener(
      'unhandledrejection',
      this.handleUnhandledRejection,
    );
  }

  private handleWindowError = (event: ErrorEvent) => {
    const msg = event.message || '';
    if (msg.includes('ResizeObserver loop')) return;
    const err = event.error
      ? normalizeError(event.error)
      : new Error(msg || 'Unknown window runtime error');
    console.error('[Echoes] Uncaught window error:', err);
    this.setState((prev) =>
      prev.error ? prev : { error: err, errorSource: 'Runtime Error' },
    );
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const err = normalizeError(event.reason);
    console.error('[Echoes] Unhandled promise rejection:', err);
    this.setState((prev) =>
      prev.error ? prev : { error: err, errorSource: 'Async Startup Error' },
    );
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetSave = () => {
    try {
      window.localStorage?.removeItem(SAVE_STORAGE_KEY);
      window.localStorage?.removeItem(SETTINGS_STORAGE_KEY);
    } catch {
      // Ignore storage access restrictions
    }
    window.location.reload();
  };

  render() {
    const { error, errorSource } = this.state;
    if (!error) {
      return this.props.children;
    }

    const isCanvas = this.props.scope === 'canvas';

    return (
      <div
        role="alert"
        data-testid={isCanvas ? 'canvas-error-fallback' : 'root-error-fallback'}
        style={{
          position: isCanvas ? 'absolute' : 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          background:
            'radial-gradient(circle at 50% 40%, #1d282b 0%, #0d1214 100%)',
          color: '#efe5cf',
          fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '34rem',
            borderRadius: '0.5rem',
            border: '1px solid rgba(196, 155, 86, 0.5)',
            background: 'rgba(18, 24, 26, 0.96)',
            padding: '1.75rem',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.72rem',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#c79d52',
            }}
          >
            {errorSource ?? 'Expedition Interrupted'}
          </p>
          <h2
            style={{
              margin: '0.35rem 0 0.75rem',
              fontFamily: "'Cinzel', Georgia, serif",
              fontSize: '1.45rem',
              color: '#f7ebd2',
            }}
          >
            {isCanvas
              ? 'Unable to Initialize 3D Island Viewport'
              : 'Something Went Wrong Starting the Game'}
          </h2>
          <p
            style={{
              margin: '0 0 1rem',
              fontSize: '0.88rem',
              lineHeight: 1.55,
              color: '#cfc3aa',
            }}
          >
            {isCanvas
              ? 'The 3D graphics or physics engine could not start in this browser session. You can reload the page, enable WebGL hardware acceleration, or reset local save data.'
              : 'An unexpected error prevented the game from rendering. Try reloading the page or resetting your saved expedition data.'}
          </p>

          <details
            style={{
              marginBottom: '1.15rem',
              borderRadius: '0.375rem',
              border: '1px solid rgba(199, 157, 82, 0.28)',
              background: 'rgba(9, 13, 15, 0.85)',
              padding: '0.65rem 0.85rem',
              fontSize: '0.78rem',
              color: '#e6dac0',
            }}
          >
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Technical Details ({error.message || 'Unknown error'})
            </summary>
            <pre
              style={{
                marginTop: '0.6rem',
                maxHeight: '11rem',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: '0.72rem',
                color: '#fca5a5',
              }}
            >
              {error.stack || error.message}
            </pre>
          </details>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                cursor: 'pointer',
                borderRadius: '0.375rem',
                border: '1px solid rgba(212, 173, 102, 0.7)',
                background: 'linear-gradient(180deg, #256f68 0%, #174c47 100%)',
                color: '#f9f1df',
                padding: '0.6rem 1.1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              Reload
            </button>
            <button
              type="button"
              onClick={this.handleResetSave}
              style={{
                cursor: 'pointer',
                borderRadius: '0.375rem',
                border: '1px solid rgba(184, 146, 74, 0.4)',
                background: 'rgba(34, 41, 43, 0.9)',
                color: '#e6dac0',
                padding: '0.6rem 1.1rem',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              Reset save data
            </button>
          </div>
        </div>
      </div>
    );
  }
}
