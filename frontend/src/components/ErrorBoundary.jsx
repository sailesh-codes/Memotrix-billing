import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[MEMOTRIX ERROR BOUNDARY] Uncaught App Crash:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleClearCacheAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <span className="text-2xl">⚠️</span>
              <h1 className="text-xl font-bold">Memotrix Application Crash Detected</h1>
            </div>
            
            <p className="text-sm text-slate-300">
              An uncaught JavaScript runtime error occurred while rendering the application UI.
            </p>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto text-xs font-mono text-red-300 max-h-60">
              {String(this.state.error && this.state.error.stack ? this.state.error.stack : this.state.error)}
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleClearCacheAndReload}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition"
              >
                Clear Cache & Reset Session
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
