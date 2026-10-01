import { deckDetailSchema, deckSummarySchema, type DeckInput } from '@flashcards/shared';
import { z } from 'zod';
import { api, apiVoid } from '../../lib/apiClient';

export const decksApi = {
  list: () => api('/decks', z.array(deckSummarySchema)),
  get: (deckId: string) => api(`/decks/${deckId}`, deckDetailSchema),
  create: (body: DeckInput) => api('/decks', deckDetailSchema, { method: 'POST', body: JSON.stringify(body) }),
  /** Returns the summary (no card list): renaming shouldn't re-download every card. */
  update: (deckId: string, body: DeckInput) =>
    api(`/decks/${deckId}`, deckSummarySchema, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (deckId: string) => apiVoid(`/decks/${deckId}`, { method: 'DELETE' }),
};
