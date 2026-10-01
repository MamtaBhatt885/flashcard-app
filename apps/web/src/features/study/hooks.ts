import type { AnswerInput, CompleteSessionInput, StartSessionInput } from '@flashcards/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { keys } from '../../lib/queryKeys';
import { studyApi } from './api';

// Sessions are created with POST, so they're mutations, not queries: nothing here is cached or refetched.

export function useStartSession(deckId: string) {
  return useMutation({ mutationFn: (body: StartSessionInput) => studyApi.start(deckId, body) });
}

export function useAnswerCard() {
  return useMutation({
    mutationFn: ({ sessionId, ...body }: AnswerInput & { sessionId: string }) => studyApi.answer(sessionId, body),
  });
}

export function useCompleteSession(deckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, ...body }: CompleteSessionInput & { sessionId: string }) => studyApi.complete(sessionId, body),
    // Answers changed due dates: refresh the deck page and the deck list counts.
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: keys.deck(deckId) }),
        qc.invalidateQueries({ queryKey: keys.decks, exact: true }),
      ]),
  });
}
