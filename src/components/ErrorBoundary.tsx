import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo?: { componentStack?: string };
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  private handleUnhandledError = (event: ErrorEvent) => {
    console.error('Unhandled error caught by ErrorBoundary:', event.error);
    this.setState({ hasError: true, error: event.error });
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    // Avoid double reporting
    const reason = event.reason;
    if (!reason) return;

    const message = reason instanceof Error ? reason.message : String(reason);
    
    // Attempt to extract information from our JSON-formatted Firestore errors
    let displayMessage = 'Ocurrió un error en una operación asíncrona.';
    let isFireballError = false;

    try {
      // Check if message is a JSON string from our db.ts handleFirestoreError
      if (typeof message === 'string' && message.startsWith('{') && message.includes('operationType')) {
        const parsed = JSON.parse(message);
        if (parsed.error && parsed.operationType) {
          // If it's a permission/connectivity issue, we usually handle these with toasts.
          // We can silent them here if they would just clutter the UI, but usually it's better to log.
          displayMessage = `Database Error (${parsed.operationType} in ${parsed.path || 'unknown'}): ${parsed.error}`;
          isFireballError = true;
          
          if (parsed.error.includes('insufficient permissions') || parsed.error.includes('offline')) {
            console.warn('Common async error (usually handled):', parsed.error);
            // We still want the ErrorBoundary to show it if truly unhandled, 
            // but maybe we don't want to CRITICAL log it.
          }
        }
      } else if (message) {
        displayMessage = message;
      }
    } catch (e) {
      if (message) displayMessage = message;
    }

    console.error('Unhandled promise rejection:', reason);

    this.setState({
      hasError: true,
      error: reason instanceof Error ? reason : new Error(displayMessage),
      errorInfo: { componentStack: 'Async Background Operation' }
    });
  };

  public componentDidMount() {
    window.addEventListener('error', this.handleUnhandledError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  public componentWillUnmount() {
    window.removeEventListener('error', this.handleUnhandledError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Algo salió mal.";
      let isPermissionError = false;

      try {
        const errorData = JSON.parse(this.state.error?.message || '{}');
        if (errorData.error && errorData.error.includes('insufficient permissions')) {
          isPermissionError = true;
          errorMessage = "No tienes permisos suficientes para realizar esta acción o ver estos datos.";
        }
      } catch (e) {
        // Not a JSON error
        if (this.state.error?.message.includes('insufficient permissions')) {
          isPermissionError = true;
          errorMessage = "No tienes permisos suficientes.";
        }
      }

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center text-red-500">
            <AlertCircle size={40} />
          </div>
          <div className="space-y-2 max-w-md">
            <h2 className="text-2xl font-black tracking-tighter text-white">¡Ups! Error de Sistema</h2>
            <p className="text-gray-500 text-sm">{errorMessage}</p>
            {isPermissionError && (
              <p className="text-primary text-xs font-bold uppercase tracking-widest mt-4">
                Asegúrate de haber iniciado sesión como Administrador si intentas modificar datos.
              </p>
            )}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-white/5 border border-white/10 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all"
          >
            <RefreshCcw size={16} />
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
