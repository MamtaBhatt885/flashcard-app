import type { Card } from '@flashcards/shared';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';

interface StudySummaryProps {
  deckId: string;
  score: { correct: number; incorrect: number; skipped: number; percent: number };
  missed: Card[];
  practice: boolean;
  onPracticeMissed: () => void;
}

function verdict(percent: number) {
  if (percent >= 90) return 'Excellent work!';
  if (percent >= 70) return 'Nice job!';
  if (percent >= 50) return 'Getting there.';
  return 'Keep practicing. It sticks with repetition.';
}

export function StudySummary({ deckId, score, missed, practice, onPracticeMissed }: StudySummaryProps) {
  const answered = score.correct + score.incorrect;

  return (
    <section aria-labelledby="summary-title" className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200 sm:p-10">
      <p className="text-5xl font-bold text-indigo-600">{answered ? `${score.percent}%` : '–'}</p>
      <h2 id="summary-title" className="mt-2 text-xl font-semibold">
        {practice ? 'Practice complete' : 'Session complete'}
      </h2>
      {answered > 0 && <p className="mt-1 text-slate-500">{verdict(score.percent)}</p>}

      <dl className="mt-6 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl bg-emerald-50 p-3">
          <dt className="text-emerald-700">Correct</dt>
          <dd className="text-2xl font-semibold text-emerald-800">{score.correct}</dd>
        </div>
        <div className="rounded-xl bg-red-50 p-3">
          <dt className="text-red-700">Incorrect</dt>
          <dd className="text-2xl font-semibold text-red-800">{score.incorrect}</dd>
        </div>
        <div className="rounded-xl bg-slate-100 p-3">
          <dt className="text-slate-600">Skipped</dt>
          <dd className="text-2xl font-semibold text-slate-700">{score.skipped}</dd>
        </div>
      </dl>

      {missed.length > 0 && (
        <div className="mt-6 text-left">
          <h3 className="mb-2 text-sm font-medium text-slate-700">Cards to review</h3>
          <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {missed.map((c) => (
              <li key={c.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-2 sm:gap-4">
                <span className="font-medium">{c.front}</span>
                <span className="text-slate-600">{c.back}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {missed.length > 0 && (
          <Button onClick={onPracticeMissed}>Practice missed cards ({missed.length})</Button>
        )}
        <Link to={`/decks/${deckId}`}><Button variant="secondary">Back to deck</Button></Link>
        <Link to="/"><Button variant="secondary">All decks</Button></Link>
      </div>
      {missed.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">Practice doesn’t change your review schedule.</p>
      )}
    </section>
  );
}
