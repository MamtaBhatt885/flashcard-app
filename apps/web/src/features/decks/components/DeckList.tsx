import type { DeckSummary } from '@flashcards/shared';
import { Button } from '../../../components/ui/Button';
import { errorMessage } from '../../../lib/errors';
import { useDecks } from '../hooks';
import { DeckCard } from './DeckCard';

interface DeckListProps {
  onStudy: (deck: DeckSummary) => void;
  onEdit: (deck: DeckSummary) => void;
  onDelete: (deck: DeckSummary) => void;
  /** Called from the empty state's call-to-action. */
  onCreate: () => void;
}

const grid = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';

/**
 * Grid of DeckCards. Data comes only through the useDecks hook (TanStack Query),
 * never a direct fetch, so it shares the cache with the rest of the app.
 * Handles loading, error, empty and success states.
 */
export function DeckList({ onStudy, onEdit, onDelete, onCreate }: DeckListProps) {
  const { data: decks, isPending, isError, error, refetch, isRefetching } = useDecks();

  if (isPending) return <DeckListSkeleton />;

  if (isError) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
        <p className="font-medium text-red-800">Couldn’t load your decks</p>
        <p className="mt-1 text-sm text-red-700">{errorMessage(error)}</p>
        <Button variant="secondary" className="mt-4" loading={isRefetching} onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (decks.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-300 px-6 py-14 text-center">
        <p aria-hidden className="text-4xl">🗂️</p>
        <p className="mt-3 font-medium text-slate-800">No decks yet</p>
        <p className="mt-1 text-sm text-slate-500">Create a deck, add some cards, and start studying.</p>
        <Button className="mt-5" onClick={onCreate}>Create your first deck</Button>
      </div>
    );
  }

  return (
    <ul className={grid} aria-label="Your decks">
      {decks.map((deck) => (
        <li key={deck.id} className="contents">
          <DeckCard deck={deck} onStudy={onStudy} onEdit={onEdit} onDelete={onDelete} />
        </li>
      ))}
    </ul>
  );
}

/** Placeholder cards shaped like DeckCards, so the layout doesn't jump when data arrives. */
function DeckListSkeleton() {
  return (
    <div className={grid} role="status" aria-busy="true" aria-label="Loading decks">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="animate-pulse rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <div className="h-4 w-2/3 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-1/3 rounded bg-slate-200" />
          <div className="mt-6 flex gap-2">
            <div className="h-9 flex-1 rounded-lg bg-slate-200" />
            <div className="h-9 w-14 rounded-lg bg-slate-200" />
            <div className="h-9 w-16 rounded-lg bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
