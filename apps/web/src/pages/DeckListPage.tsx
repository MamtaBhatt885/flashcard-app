import type { DeckSummary } from '@flashcards/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DeckForm, DeckList, useCreateDeck, useDecks, useDeleteDeck } from '../features/decks';
import { errorMessage } from '../lib/errors';

/** Home page: deck grid plus "new deck". The grid's data states live in <DeckList>. */
export function DeckListPage() {
  const navigate = useNavigate();
  const { data: decks } = useDecks(); // same cached query DeckList uses: no second request
  const createDeck = useCreateDeck();
  const deleteDeck = useDeleteDeck();
  const [creating, setCreating] = useState(false);

  // The deck awaiting confirmation; null when the dialog is closed.
  const [pendingDelete, setPendingDelete] = useState<DeckSummary | null>(null);
  const closeDelete = () => {
    setPendingDelete(null);
    deleteDeck.reset();
  };

  const totalDue = decks?.reduce((n, d) => n + d.dueCount, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Your decks</h1>
          {decks && decks.length > 0 && (
            <p className="mt-1 text-sm text-slate-500">
              {totalDue > 0 ? `${totalDue} ${totalDue === 1 ? 'card' : 'cards'} due for review` : 'You’re all caught up'}
            </p>
          )}
        </div>
        {!creating && decks && decks.length > 0 && <Button onClick={() => setCreating(true)}>New deck</Button>}
      </div>

      {creating && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-4 font-semibold">New deck</h2>
          <DeckForm
            mode="create"
            pending={createDeck.isPending}
            serverError={createDeck.error && errorMessage(createDeck.error)}
            onCancel={() => setCreating(false)}
            onSubmit={(values) => createDeck.mutate(values, { onSuccess: (deck) => navigate(`/decks/${deck.id}`) })}
          />
        </section>
      )}

      {!creating || (decks && decks.length > 0) ? (
        <DeckList
          onStudy={(d) => navigate(`/decks/${d.id}/study`)}
          onEdit={(d) => navigate(`/decks/${d.id}?edit=1`)}
          onDelete={setPendingDelete}
          onCreate={() => setCreating(true)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete deck?"
        confirmLabel="Delete deck"
        pending={deleteDeck.isPending}
        error={deleteDeck.error && errorMessage(deleteDeck.error)}
        onCancel={closeDelete}
        onConfirm={() => pendingDelete && deleteDeck.mutate(pendingDelete.id, { onSuccess: closeDelete })}
      >
        {pendingDelete && (
          <>
            “<strong className="text-slate-900">{pendingDelete.title}</strong>” and its{' '}
            {pendingDelete.cardCount} {pendingDelete.cardCount === 1 ? 'card' : 'cards'} will be permanently deleted,
            along with its study history.
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
