import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import { FormError } from './Field';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** While the action runs: confirm shows a spinner, both buttons lock, Esc is ignored. */
  pending?: boolean;
  /** Shown inside the dialog, so a failed delete doesn't just vanish. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Accessible replacement for window.confirm(), built on the native <dialog> element:
 * - showModal() makes the rest of the page inert and traps focus inside the dialog
 * - Esc and a click on the backdrop cancel; focus returns to the button that opened it
 * - initial focus is on Cancel, so a stray Enter can't delete anything
 * - the <dialog> element stays mounted (so close() can return focus), but its content only renders while open
 */
export function ConfirmDialog({ open, title, children, confirmLabel, pending, error, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // Esc fires "cancel": keep React in charge of open/closed state.
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onCancel();
      }}
      // A click whose target is the <dialog> itself landed on the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 shadow-xl ring-1 ring-slate-200 backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm"
    >
      {/* Content only exists while open: a list of rows doesn't carry N hidden dialogs' text. */}
      {open && (
      <div className="space-y-4 p-6">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">{title}</h2>
        <div id={bodyId} className="text-sm text-slate-600">{children}</div>
        <FormError message={error} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onCancel} disabled={pending} autoFocus>
            Cancel
          </Button>
          <Button onClick={onConfirm} loading={pending} className="bg-red-600 hover:bg-red-500">
            {confirmLabel}
          </Button>
        </div>
      </div>
      )}
    </dialog>
  );
}
