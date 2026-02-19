import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);

    // Auto-recover from DOM manipulation errors caused by browser extensions
    // (Google Translate, Grammarly, etc.)
    const isDOMError = error.message?.includes("removeChild") ||
      error.message?.includes("insertBefore") ||
      error.message?.includes("appendChild") ||
      error.name === "NotFoundError";

    if (isDOMError && this.state.retryCount < 3) {
      console.warn("DOM manipulation error detected (likely browser extension). Auto-recovering...");
      // Reset error state and try to re-render
      setTimeout(() => {
        this.setState(prev => ({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: prev.retryCount + 1,
        }));
      }, 100);
      return;
    }

    this.setState({ error, errorInfo });
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });
  };

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

            {this.state.error?.message?.includes("removeChild") && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  💡 Tato chyba je obvykle způsobena rozšířeními prohlížeče (Google Translate, Grammarly apod.).
                  Zkuste je deaktivovat nebo klikněte na "Zkusit znovu".
                </p>
              </div>
            )}

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

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
              >
                Zkusit znovu
              </button>
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
