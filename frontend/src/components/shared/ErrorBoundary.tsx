import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React Error:', error, errorInfo);
  }

  handleReset = () => {
    try {
      window.sessionStorage.clear();
      window.localStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: '100vh',
            width: '100vw',
            backgroundColor: '#0f1117',
            color: '#e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '24px',
            boxSizing: 'border-box',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              backgroundColor: '#181b24',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '28px 24px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', margin: '0 0 12px 0', color: '#f87171' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              The workspace encountered an unexpected rendering error. You can reload or reset stored workspace settings.
            </p>
            {this.state.error?.message && (
              <pre
                style={{
                  fontSize: '0.75rem',
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  color: '#fca5a5',
                  overflowX: 'auto',
                  margin: '0 0 20px 0',
                  textAlign: 'left',
                }}
              >
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  backgroundColor: '#334155',
                  color: '#f8fafc',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Reset Workspace &amp; Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
