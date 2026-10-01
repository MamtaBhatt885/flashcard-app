import type { DeckDetail, DeckSummary } from '@flashcards/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { StudySession } from '../features/study';
import { keys } from '../lib/queryKeys';

export function StudySessionPage() {
  const { deckId = '' } = useParams();
  // The deck name for the back link comes from data already cached by the deck list or deck page.
  // Fetching the whole deck (every card) just for its title would be over-fetching.
  const qc = useQueryClient();
  const title =
    qc.getQueryData<DeckSummary[]>(keys.decks)?.find((d) => d.id === deckId)?.title ??
    qc.getQueryData<DeckDetail>(keys.deck(deckId))?.title;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Link to={`/decks/${deckId}`} className="text-sm text-slate-500 hover:text-slate-700">← {title ?? 'Back to deck'}</Link>
        <span className="hidden text-xs text-slate-400 sm:inline">Space: flip · ← Incorrect · → Correct · S: skip</span>
      </div>
      <StudySession deckId={deckId} />
    </div>
  );
}
