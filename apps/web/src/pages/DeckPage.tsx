import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '../components/ui/Button';
import { EmptyState, Spinner } from '../components/ui/Feedback';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { FormError } from '../components/ui/Field';
import { CardForm, CardRow, useCreateCard } from '../features/cards';
import { DeckForm, useDeck, useDeleteDeck, useUpdateDeck } from '../features/decks';
import { errorMessage, isNotFound } from '../lib/errors';

export function DeckPage() {
  const { deckId = '' } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const editing = params.get('edit') === '1';
  const setEditing = (on: boolean) => setParams(on ? { edit: '1' } : {}, { replace: true });

  const { data: deck, isPending, error } = useDeck(deckId);
  const updateDeck = useUpdateDeck(deckId);
  const deleteDeck = useDeleteDeck();
  const createCard = useCreateCard(deckId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (isPending) return <Spinner />;
  if (isNotFound(error)) {
    return (
      <EmptyState title="Deck not found">
        It may have been deleted. <Link to="/" className="text-indigo-600 hover:underline">Back to your decks</Link>
      </EmptyState>
    );
  }
  if (error) return <FormError message={errorMessage(error)} />;

  return (
    <div className="space-y-8">
      <Link to="/" className="text-sm text-slate-500 hover:text-slate-700">← All decks</Link>

      {editing ? (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-4 font-semibold">Edit deck</h2>
          <DeckForm
            key={deck.id}
            mode="edit"
            initialValues={{ title: deck.title, description: deck.description }}
            pending={updateDeck.isPending}
            serverError={updateDeck.error && errorMessage(updateDeck.error)}
            onCancel={() => setEditing(false)}
            onSubmit={(values) => updateDeck.mutate(values, { onSuccess: () => setEditing(false) })}
          />
        </section>
      ) : (
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{deck.title}</h1>
            {deck.description && <p className="mt-1 text-slate-500">{deck.description}</p>}
            <p className="mt-2 text-sm text-slate-500">
              {deck.cardCount} {deck.cardCount === 1 ? 'card' : 'cards'} · {deck.dueCount} due
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)} aria-label="Edit deck">Edit</Button>
            <Button variant="danger" onClick={() => setConfirmingDelete(true)} aria-label="Delete deck">Delete</Button>
            <Button onClick={() => navigate(`/decks/${deck.id}/study`)} disabled={deck.cardCount === 0}>
              Study{deck.dueCount > 0 ? ` (${deck.dueCount})` : ''}
            </Button>
          </div>
        </header>
      )}

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 font-semibold">Add a card</h2>
        <CardForm
          submitLabel="Add card"
          pending={createCard.isPending}
          error={createCard.error && errorMessage(createCard.error)}
          onSubmit={(values) => createCard.mutateAsync(values)}
        />
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Cards</h2>
        {deck.cards.length === 0 ? (
          <EmptyState title="No cards yet">Add your first card above.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {deck.cards.map((card) => <CardRow key={card.id} card={card} />)}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete deck?"
        confirmLabel="Delete deck"
        pending={deleteDeck.isPending}
        error={deleteDeck.error && errorMessage(deleteDeck.error)}
        onCancel={() => {
          setConfirmingDelete(false);
          deleteDeck.reset();
        }}
        onConfirm={() => deleteDeck.mutate(deck.id, { onSuccess: () => navigate('/') })}
      >
        “<strong className="text-slate-900">{deck.title}</strong>” and all {deck.cardCount}{' '}
        {deck.cardCount === 1 ? 'card' : 'cards'} will be permanently deleted, along with its study history.
      </ConfirmDialog>
    </div>
  );
}
