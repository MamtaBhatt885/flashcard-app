import { DECK_LIMITS, deckInputSchema, type DeckInput } from '@flashcards/shared';
import { useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Button } from '../../../components/ui/Button';
import { FormError, TextAreaField, TextField } from '../../../components/ui/Field';

type Values = { title: string; description: string };
type FieldName = keyof Values;
type Errors = Partial<Record<FieldName, string>>;

interface DeckFormProps {
  mode: 'create' | 'edit';
  /** Starting values in edit mode. To reset the form for a different deck, change its `key`. */
  initialValues?: { title?: string; description?: string | null };
  /** Receives the schema-parsed values (trimmed; empty description → undefined). */
  onSubmit: (values: DeckInput) => void;
  onCancel?: () => void;
  pending?: boolean;
  /** Error from the server (e.g. network failure), shown above the fields. */
  serverError?: string | null;
}

/** Runs the shared Zod schema, the same one the API uses, and returns one message per field. */
function validate(values: Values): { data?: DeckInput; errors: Errors } {
  const result = deckInputSchema.safeParse({
    title: values.title,
    description: values.description.trim() === '' ? undefined : values.description,
  });
  if (result.success) return { data: result.data, errors: {} };
  const fieldErrors = z.flattenError(result.error).fieldErrors;
  return { errors: { title: fieldErrors.title?.[0], description: fieldErrors.description?.[0] } };
}

/**
 * Create/edit form for a deck.
 * - Controlled inputs: React state is the single source of truth for the values.
 * - Validation: the shared deckInputSchema. A field shows errors once it has been
 *   blurred (touched) or the form was submitted, then updates live as you type.
 * - Accessible: labeled fields, aria-invalid/aria-describedby, focus moves to the first error.
 */
export function DeckForm({ mode, initialValues, onSubmit, onCancel, pending, serverError }: DeckFormProps) {
  const initial: Values = {
    title: initialValues?.title ?? '',
    description: initialValues?.description ?? '',
  };
  const [values, setValues] = useState<Values>(initial);
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({ title: false, description: false });
  const [submitted, setSubmitted] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const { errors } = validate(values);
  const visibleError = (field: FieldName) => (submitted || touched[field] ? errors[field] : undefined);

  const isDirty = values.title !== initial.title || values.description !== initial.description;

  const setField = (field: FieldName) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));
  const touch = (field: FieldName) => () => setTouched((t) => ({ ...t, [field]: true }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const { data, errors: submitErrors } = validate(values);
    if (!data) {
      const firstInvalid = (['title', 'description'] as const).find((f) => submitErrors[f]);
      if (firstInvalid === 'title') titleRef.current?.focus();
      else if (firstInvalid === 'description') descriptionRef.current?.focus();
      return;
    }
    onSubmit(data);
  };

  const counter = (field: FieldName) => {
    const len = values[field].trim().length;
    const max = DECK_LIMITS[field];
    return <span className={len > max ? 'text-red-600' : undefined}>{len}/{max}</span>;
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4" aria-label={mode === 'create' ? 'Create deck' : 'Edit deck'}>
      <FormError message={serverError} />

      <TextField
        ref={titleRef}
        label="Title"
        name="title"
        required
        autoFocus
        placeholder="e.g. Spanish vocabulary"
        value={values.title}
        onChange={setField('title')}
        onBlur={touch('title')}
        error={visibleError('title')}
        hint={counter('title')}
      />

      <TextAreaField
        ref={descriptionRef}
        label="Description (optional)"
        name="description"
        placeholder="What's this deck for?"
        value={values.description}
        onChange={setField('description')}
        onBlur={touch('description')}
        error={visibleError('description')}
        hint={counter('description')}
      />

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={pending} disabled={mode === 'edit' && !isDirty}>
          {mode === 'create' ? 'Create deck' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
