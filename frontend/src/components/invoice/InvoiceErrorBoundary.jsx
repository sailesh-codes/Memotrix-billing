import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class InvoiceErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[INVOICE ERROR BOUNDARY] Caught invoice render exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-center space-y-4 max-w-lg mx-auto my-8">
          <div className="p-3 bg-rose-100 dark:bg-rose-900 text-rose-600 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-rose-900 dark:text-rose-100">Couldn't load this invoice preview</h3>
            <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">
              {this.state.error?.message || 'An unexpected rendering error occurred. Please try again or contact support.'}
            </p>
          </div>
          <div className="flex justify-center space-x-3 pt-2">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition flex items-center shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Try Reloading Preview
            </button>
            {this.props.onClose && (
              <button
                onClick={this.props.onClose}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-300 rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default InvoiceErrorBoundary;
