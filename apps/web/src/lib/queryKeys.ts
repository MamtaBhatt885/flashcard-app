/** Central TanStack Query keys, so invalidation always targets the right cache entries. */
export const keys = {
  me: ['me'] as const,
  /** Set when a 401 signs the user out mid-use, so the login page can say why. */
  sessionExpired: ['sessionExpired'] as const,
  decks: ['decks'] as const,
  deck: (deckId: string) => ['decks', deckId] as const,
};
