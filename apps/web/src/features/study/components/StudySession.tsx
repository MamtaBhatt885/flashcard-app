import { useEffect } from 'react';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { EmptyState, Spinner } from '../../../components/ui/Feedback';
import { FormError } from '../../../components/ui/Field';
import { errorMessage, isNotFound } from '../../../lib/errors';
import { useStudySession } from '../useStudySession';
import { FlipCard } from './FlipCard';
import { ProgressBar } from './ProgressBar';
import { StudySummary } from './StudySummary';

/** Renders whatever state useStudySession is in. All session logic lives in the hook and reducer. */
export function StudySession({ deckId }: { deckId: string }) {
  const s = useStudySession(deckId);

  // Keyboard: Space/Enter flips · ← or 1 = Incorrect · → or 2 = Correct · S = Skip
  const { status, flip, answer, skip } = s;
  useEffect(() => {
    if (status !== 'studying') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flip();
      } else if (e.key === 'ArrowLeft' || e.key === '1') answer(false);
      else if (e.key === 'ArrowRight' || e.key === '2') answer(true);
      else if (e.key.toLowerCase() === 's') skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, flip, answer, skip]);

  switch (s.status) {
    case 'loading':
      return <Spinner label="Loading cards…" />;

    case 'error':
      if (isNotFound(s.loadError)) {
        return (
          <EmptyState title="Deck not found">
            It may have been deleted. <Link to="/" className="text-indigo-600 hover:underline">Back to your decks</Link>
          </EmptyState>
        );
      }
      return <FormError message={errorMessage(s.loadError)} />;

    case 'empty':
      return (
        <EmptyState title="Nothing due right now 🎉">
          Come back later, or{' '}
          <Link to={`/decks/${deckId}`} className="text-indigo-600 hover:underline">add more cards</Link>.
        </EmptyState>
      );

    case 'finished':
      return (
        <StudySummary
          deckId={deckId}
          score={s.score}
          missed={s.missed}
          practice={s.practice}
          onPracticeMissed={s.practiceMissed}
        />
      );

    case 'studying': {
      const card = s.current!;
      return (
        <div className="space-y-5">
          {s.practice && (
            <p className="rounded-lg bg-indigo-50 px-3 py-2 text-center text-sm text-indigo-700">
              Practice mode: answers here don’t change your schedule.
            </p>
          )}

          <ProgressBar
            position={s.progress.position}
            done={s.progress.done}
            total={s.progress.total}
            correct={s.score.correct}
            incorrect={s.score.incorrect}
          />

          {s.isRetry && !s.flipped && (
            <p className="text-center text-sm text-amber-700">You missed this one earlier. Try again!</p>
          )}

          <FlipCard
            key={`${card.id}-${s.progress.done}-${s.score.incorrect}`}
            front={card.front}
            back={card.back}
            flipped={s.flipped}
            onFlip={s.flip}
          />

          <FormError message={s.saveError && `Last answer wasn’t saved: ${errorMessage(s.saveError)}`} />

          {s.flipped ? (
            <div className="space-y-2">
              <p className="text-center text-sm text-slate-500">Did you get it right?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => s.answer(false)}
                  className="rounded-xl bg-red-600 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-red-500"
                >
                  ✗ Incorrect
                </button>
                <button
                  onClick={() => s.answer(true)}
                  className="rounded-xl bg-emerald-600 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-500"
                >
                  ✓ Correct
                </button>
              </div>
            </div>
          ) : (
            <Button className="w-full py-4 text-base" onClick={s.flip}>Show answer</Button>
          )}

          <div className="text-center">
            <button onClick={s.skip} className="text-sm text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline">
              Skip this card →
            </button>
          </div>
        </div>
      );
    }
  }
}
