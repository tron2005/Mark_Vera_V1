import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-6 border border-red-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle className="h-8 w-8" />
              <h1 className="text-2xl font-bold">Něco se pokazilo</h1>
            </div>
            
            <div className="bg-slate-100 p-4 rounded-md overflow-x-auto mb-4">
              <code className="text-sm font-mono text-red-700">
                {this.state.error && this.state.error.toString()}
              </code>
            </div>

            {this.state.errorInfo && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-600">
                  Zobrazit detaily chyby (Stack Trace)
                </summary>
                <div className="mt-2 text-xs font-mono bg-slate-50 p-4 rounded border border-slate-200 overflow-x-auto whitespace-pre">
                  {this.state.errorInfo.componentStack}
                </div>
              </details>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Obnovit stránku
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
