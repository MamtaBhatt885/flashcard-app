import type { DeckDetail, DeckInput, DeckSummary } from '@flashcards/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { keys } from '../../lib/queryKeys';
import { decksApi } from './api';

export function useDecks() {
  return useQuery({ queryKey: keys.decks, queryFn: decksApi.list });
}

export function useDeck(deckId: string) {
  return useQuery({ queryKey: keys.deck(deckId), queryFn: () => decksApi.get(deckId) });
}

export function useCreateDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: decksApi.create,
    onSuccess: (deck) => {
      qc.setQueryData(keys.deck(deck.id), deck);
      qc.invalidateQueries({ queryKey: keys.decks, exact: true });
    },
  });
}

export function useUpdateDeck(deckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DeckInput) => decksApi.update(deckId, body),
    onSuccess: (summary) => {
      // Merge the new title/description/counts into the cached deck; its cards are unchanged.
      qc.setQueryData<DeckDetail>(keys.deck(deckId), (old) => (old ? { ...old, ...summary } : old));
      // Keep the server's ordering (most recently updated first): a renamed deck moves to the top.
      qc.setQueryData<DeckSummary[]>(keys.decks, (old) =>
        old?.map((d) => (d.id === deckId ? summary : d)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      );
    },
  });
}

export function useDeleteDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: decksApi.remove,
    onSuccess: (_void, deckId) => {
      qc.removeQueries({ queryKey: keys.deck(deckId) });
      qc.invalidateQueries({ queryKey: keys.decks, exact: true });
    },
  });
}
