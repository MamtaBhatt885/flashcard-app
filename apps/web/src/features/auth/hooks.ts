import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../lib/apiClient';
import { keys } from '../../lib/queryKeys';
import { authApi } from './api';

/** Current user, or null when signed out. */
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
  });
}

// meta.url marks credential endpoints: their 401 means "wrong password", not "session expired".
export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.login,
    meta: { url: '/auth/login' },
    onSuccess: (user) => {
      qc.removeQueries({ queryKey: keys.sessionExpired });
      qc.setQueryData(keys.me, user);
    },
  });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.signup,
    meta: { url: '/auth/signup' },
    onSuccess: (user) => {
      qc.removeQueries({ queryKey: keys.sessionExpired });
      qc.setQueryData(keys.me, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      // Mark signed out first (RequireAuth redirects on this), then drop the previous user's
      // cached data. qc.clear() would also remove the `me` entry the guards are observing,
      // leaving them stuck on the old value.
      qc.setQueryData(keys.me, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== keys.me[0] });
      qc.removeQueries({ queryKey: keys.sessionExpired }); // a deliberate logout isn't an expiry
    },
  });
}
