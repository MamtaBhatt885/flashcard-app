import { userSchema, type CredentialsInput } from '@flashcards/shared';
import { api, apiVoid } from '../../lib/apiClient';

export const authApi = {
  me: () => api('/auth/me', userSchema),
  login: (body: CredentialsInput) => api('/auth/login', userSchema, { method: 'POST', body: JSON.stringify(body) }),
  signup: (body: CredentialsInput) => api('/auth/signup', userSchema, { method: 'POST', body: JSON.stringify(body) }),
  logout: () => apiVoid('/auth/logout', { method: 'POST' }),
};
