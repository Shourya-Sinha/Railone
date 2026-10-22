import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource-variable/inter';
import './index.css';
import { App } from './App';
import { ApiError } from './lib/api';
import { AuthProvider, ME_KEY } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { reportClientError } from './lib/errorReporter';

const onAuthError = (e: unknown, key?: readonly unknown[]) => {
  if (e instanceof ApiError && e.status === 401 && key?.[0] !== 'me') queryClient.setQueryData(ME_KEY, null);
};

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (e, q) => onAuthError(e, q.queryKey) }),
  mutationCache: new MutationCache({ onError: (e) => onAuthError(e) }),
  defaultOptions: {
    queries: {
      retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
      refetchOnWindowFocus: false,
    },
  },
});

window.addEventListener('unhandledrejection', (e) => {
  if (!(e.reason instanceof ApiError)) reportClientError(e.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
