import React from 'react';
import ReactDOM from 'react-dom/client';

// Ensure React Refresh globals exist before loading modules that expect them
(window as any).$RefreshReg$ = (window as any).$RefreshReg$ || (() => {});
(window as any).$RefreshSig$ = (window as any).$RefreshSig$ || (() => (type: any) => type);

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();

  const storageKey = 'vite-preload-recovered';
  if (!sessionStorage.getItem(storageKey)) {
    sessionStorage.setItem(storageKey, '1');
    window.location.reload();
  }
});

const rootEl = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootEl);

function renderError(payload: unknown) {
  const message = typeof payload === 'string' ? payload : JSON.stringify(payload, Object.getOwnPropertyNames(payload as object), 2);
  // render a simple React component to avoid inline CSS
  const ErrorDisplay: React.FC<{message: string}> = ({message}) => (
    <div className="min-h-screen flex items-center justify-center p-4 bg-red-100">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-xl font-bold mb-2 text-red-700">Runtime error</h2>
        <pre className="text-sm text-gray-700 whitespace-pre-wrap">{message}</pre>
      </div>
    </div>
  );
  try {
    root.render(React.createElement(ErrorDisplay, { message }));
  } catch (_e) {
    // if even that fails, fallback to console
    console.error('Failed to render error display', _e, message);
  }
}

window.addEventListener('error', (e: ErrorEvent) => {
  renderError(e.error || e.message || 'Unknown error');
});

window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  renderError((e.reason && (e.reason as any).message) || e.reason || 'Unhandled rejection');
});

// Dynamically import App after ensuring refresh globals exist
import('./App')
  .then((mod) => {
    try {
      sessionStorage.removeItem('vite-preload-recovered');
      const Comp = mod.default;
      root.render(React.createElement(Comp));
    } catch (err) {
      renderError(err);
    }
  })
  .catch((err) => renderError(err));
