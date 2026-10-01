import { cardSchema, type CardInput } from '@flashcards/shared';
import { api, apiVoid } from '../../lib/apiClient';

export const cardsApi = {
  create: (deckId: string, body: CardInput) =>
    api(`/decks/${deckId}/cards`, cardSchema, { method: 'POST', body: JSON.stringify(body) }),
  update: (cardId: string, body: CardInput) =>
    api(`/cards/${cardId}`, cardSchema, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (cardId: string) => apiVoid(`/cards/${cardId}`, { method: 'DELETE' }),
};
