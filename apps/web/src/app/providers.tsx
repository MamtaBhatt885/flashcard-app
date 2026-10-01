import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError, NetworkError } from '../lib/apiClient';
import { keys } from '../lib/queryKeys';

/**
 * The backend answers 401 on ANY request once the auth cookie is gone, reads and writes alike.
 * Before, only queries were handled; a 401 from a mutation (e.g. answering a card after the
 * session expired) left the user stuck on the page with every action failing.
 * Credential endpoints are excluded: a 401 from /auth/login means "wrong password", not "expired".
 */
function onUnauthorized(err: unknown, url?: string) {
  if (!(err instanceof ApiError) || err.status !== 401) return;
  if (url?.startsWith('/auth/')) return;
  const wasSignedIn = Boolean(queryClient.getQueryData(keys.me));
  if (wasSignedIn) queryClient.setQueryData(keys.sessionExpired, true); // login page explains why
  queryClient.setQueryData(keys.me, null); // RequireAuth redirects to /login
}

/**
 * Retry only failures a retry can fix: network errors and 5xx.
 * Before, ContractError (a deterministic server/client disagreement) was retried 3×.
 */
function shouldRetry(count: number, err: unknown) {
  const transient = err instanceof NetworkError || (err instanceof ApiError && err.status >= 500);
  return transient && count < 2;
}

const queryClient: QueryClient = new QueryClient({
  // (useMe turns /auth/me's 401 into `null` itself, so it never reaches this handler.)
  queryCache: new QueryCache({ onError: (err) => onUnauthorized(err) }),
  mutationCache: new MutationCache({ onError: (err, _vars, _ctx, mutation) => onUnauthorized(err, mutation.options.meta?.url as string | undefined) }),
  defaultOptions: {
    queries: { staleTime: 30_000, retry: shouldRetry },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
