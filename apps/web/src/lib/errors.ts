import { ApiError, ContractError, NetworkError } from './apiClient';

/**
 * Human-readable message for any thrown value.
 * Before: `err instanceof TypeError` meant "offline", but ANY TypeError (a bug reading
 * `undefined.x`) would then tell the user to check the server. Now only a real network
 * failure, tagged by apiClient, gets that message; bugs show as bugs.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    // A generic 400 message: show the first field-level reason from `details` instead.
    const firstDetail = err.details && Object.values(err.details)[0]?.[0];
    return err.message === 'Invalid input' && firstDetail ? firstDetail : err.message;
  }
  if (err instanceof NetworkError) return 'Can’t reach the server. Is the API running?';
  if (err instanceof ContractError) return 'The server sent data this app doesn’t understand. Try reloading.';
  if (import.meta.env.DEV && err instanceof Error) return `Unexpected error: ${err.message}`;
  return 'Something went wrong';
}

/**
 * "This thing doesn't exist" as far as the UI is concerned. The backend answers 404 for a
 * missing/foreign id and 400 for a malformed one (e.g. a mistyped URL, /decks/typo).
 * Both should show the not-found screen, not a raw error.
 */
export function isNotFound(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.status === 404) return true;
  const idFields = ['deckId', 'cardId', 'sessionId'];
  return err.status === 400 && Object.keys(err.details ?? {}).some((k) => idFields.includes(k));
}
