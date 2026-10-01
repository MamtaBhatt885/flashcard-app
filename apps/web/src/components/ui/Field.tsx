import clsx from 'clsx';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

const control =
  'block w-full rounded-lg border-0 bg-white px-3 py-2 text-slate-900 ring-1 ring-slate-300 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600';

interface Common {
  label: string;
  error?: string;
  /** Helper text under the field (e.g. a character counter). */
  hint?: ReactNode;
}

/** Label, error and hint wiring shared by inputs and textareas (label↔id, aria-invalid, aria-describedby). */
function useFieldIds(error?: string, hint?: ReactNode) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined;
  return { id, errorId, hintId, describedBy };
}

function FieldFooter({ error, hint, errorId, hintId }: { error?: string; hint?: ReactNode; errorId: string; hintId: string }) {
  if (!error && !hint) return null;
  return (
    <div className="mt-1 flex items-start justify-between gap-3 text-sm">
      {error ? <p id={errorId} className="text-red-600">{error}</p> : <span />}
      {hint && <span id={hintId} className="shrink-0 text-slate-400">{hint}</span>}
    </div>
  );
}

export const TextField = forwardRef<HTMLInputElement, Common & InputHTMLAttributes<HTMLInputElement>>(
  function TextField({ label, error, hint, className, ...rest }, ref) {
    const { id, errorId, hintId, describedBy } = useFieldIds(error, hint);
    return (
      <div className={className}>
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
        <input
          id={id}
          ref={ref}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={clsx(control, error && 'ring-red-400')}
          {...rest}
        />
        <FieldFooter error={error} hint={hint} errorId={errorId} hintId={hintId} />
      </div>
    );
  },
);

export const TextAreaField = forwardRef<HTMLTextAreaElement, Common & TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextAreaField({ label, error, hint, className, ...rest }, ref) {
    const { id, errorId, hintId, describedBy } = useFieldIds(error, hint);
    return (
      <div className={className}>
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
        <textarea
          id={id}
          ref={ref}
          rows={3}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={clsx(control, 'resize-y', error && 'ring-red-400')}
          {...rest}
        />
        <FieldFooter error={error} hint={hint} errorId={errorId} hintId={hintId} />
      </div>
    );
  },
);

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>;
}
