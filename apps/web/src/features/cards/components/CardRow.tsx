import type { Card } from '@flashcards/shared';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { errorMessage } from '../../../lib/errors';
import { useDeleteCard, useUpdateCard } from '../hooks';
import { CardForm } from './CardForm';

function dueLabel(dueAt: string) {
  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return { text: 'Due now', cls: 'bg-amber-100 text-amber-800' };
  if (days === 1) return { text: 'Due tomorrow', cls: 'bg-slate-100 text-slate-600' };
  return { text: `Due in ${days} days`, cls: 'bg-slate-100 text-slate-600' };
}

export function CardRow({ card }: { card: Card }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const update = useUpdateCard(card.deckId);
  const remove = useDeleteCard(card.deckId);
  const due = dueLabel(card.dueAt);

  if (editing) {
    return (
      <li className="rounded-xl bg-white p-4 ring-2 ring-indigo-200">
        <CardForm
          initial={{ front: card.front, back: card.back }}
          submitLabel="Save"
          pending={update.isPending}
          error={update.error && errorMessage(update.error)}
          onSubmit={(body) => update.mutateAsync({ cardId: card.id, body }).then(() => setEditing(false))}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="grid gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
      <p className="whitespace-pre-wrap font-medium">{card.front}</p>
      <p className="whitespace-pre-wrap text-slate-600">{card.back}</p>
      <div className="flex items-center gap-1 sm:flex-col sm:items-end">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${due.cls}`}>{due.text}</span>
        <div className="ml-auto flex sm:ml-0">
          <Button variant="ghost" className="px-2 py-1" onClick={() => setEditing(true)} aria-label={`Edit card: ${card.front}`}>Edit</Button>
          <Button
            variant="danger"
            className="px-2 py-1"
            aria-label={`Delete card: ${card.front}`}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmingDelete}
        title="Delete card?"
        confirmLabel="Delete card"
        pending={remove.isPending}
        error={remove.error && errorMessage(remove.error)}
        onCancel={() => {
          setConfirmingDelete(false);
          remove.reset();
        }}
        onConfirm={() => remove.mutate(card.id)}
      >
        “<strong className="text-slate-900">{card.front}</strong>” will be permanently deleted.
      </ConfirmDialog>
    </li>
  );
}
