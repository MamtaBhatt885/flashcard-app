import { zodResolver } from '@hookform/resolvers/zod';
import { cardInputSchema, type CardInput } from '@flashcards/shared';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormError, TextAreaField } from '../../../components/ui/Field';

interface Props {
  initial?: CardInput;
  submitLabel: string;
  pending?: boolean;
  error?: string | null;
  /** Return a promise to have the form clear itself after a successful save. */
  onSubmit: (values: CardInput) => Promise<unknown> | void;
  onCancel?: () => void;
}

export function CardForm({ initial, submitLabel, pending, error, onSubmit, onCancel }: Props) {
  const { register, handleSubmit, reset, setFocus, formState: { errors } } = useForm<CardInput>({
    resolver: zodResolver(cardInputSchema),
    defaultValues: initial ?? { front: '', back: '' },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      if (!initial) {
        reset({ front: '', back: '' });
        setFocus('front'); // ready for the next card
      }
    } catch {
      /* error is shown via the `error` prop */
    }
  });

  return (
    <form noValidate onSubmit={submit} className="space-y-3">
      <FormError message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextAreaField label="Front" placeholder="Question or term" error={errors.front?.message} {...register('front')} />
        <TextAreaField label="Back" placeholder="Answer or definition" error={errors.back?.message} {...register('back')} />
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={pending}>{submitLabel}</Button>
      </div>
    </form>
  );
}
