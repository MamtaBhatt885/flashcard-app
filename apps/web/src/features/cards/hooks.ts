import type { CardInput } from '@flashcards/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { keys } from '../../lib/queryKeys';
import { cardsApi } from './api';

/** Any card change affects the deck detail and the deck list counts. */
function useInvalidateDeck(deckId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.deck(deckId) }),
      qc.invalidateQueries({ queryKey: keys.decks, exact: true }),
    ]);
}

export function useCreateCard(deckId: string) {
  const invalidate = useInvalidateDeck(deckId);
  return useMutation({ mutationFn: (body: CardInput) => cardsApi.create(deckId, body), onSuccess: invalidate });
}

export function useUpdateCard(deckId: string) {
  const invalidate = useInvalidateDeck(deckId);
  return useMutation({
    mutationFn: ({ cardId, body }: { cardId: string; body: CardInput }) => cardsApi.update(cardId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteCard(deckId: string) {
  const invalidate = useInvalidateDeck(deckId);
  return useMutation({ mutationFn: cardsApi.remove, onSuccess: invalidate });
}
