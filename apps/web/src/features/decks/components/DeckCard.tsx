import type { DeckSummary } from '@flashcards/shared';
import { Button } from '../../../components/ui/Button';

interface DeckCardProps {
  deck: DeckSummary;
  onStudy: (deck: DeckSummary) => void;
  onEdit: (deck: DeckSummary) => void;
  onDelete: (deck: DeckSummary) => void;
}

/**
 * Presentational deck summary: name, card count, and Study / Edit / Delete actions.
 * Stateless: the parent decides what each action does (navigate, confirm, mutate).
 */
export function DeckCard({ deck, onStudy, onEdit, onDelete }: DeckCardProps) {
  const { title, cardCount, dueCount } = deck;
  const isEmpty = cardCount === 0;

  return (
    <article
      aria-labelledby={`deck-${deck.id}-title`}
      className="flex min-w-0 flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md"
    >
      <h3 id={`deck-${deck.id}-title`} className="truncate font-semibold text-slate-900" title={title}>
        {title}
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        {cardCount} {cardCount === 1 ? 'card' : 'cards'}
        {dueCount > 0 && <span className="text-amber-700"> · {dueCount} due</span>}
      </p>

      <div className="mt-5 flex items-center gap-2">
        <Button
          onClick={() => onStudy(deck)}
          disabled={isEmpty}
          title={isEmpty ? 'Add cards to this deck first' : undefined}
          className="flex-1"
        >
          Study
        </Button>
        <Button variant="secondary" onClick={() => onEdit(deck)} aria-label={`Edit ${title}`}>
          Edit
        </Button>
        <Button variant="danger" onClick={() => onDelete(deck)} aria-label={`Delete ${title}`}>
          Delete
        </Button>
      </div>
    </article>
  );
}
