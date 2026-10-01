interface ProgressBarProps {
  position: number;
  done: number;
  total: number;
  correct: number;
  incorrect: number;
}

export function ProgressBar({ position, done, total, correct, incorrect }: ProgressBarProps) {
  const pct = total ? (done / total) * 100 : 0;
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm text-slate-500">
        <span>Card {position} of {total}</span>
        <span>
          <span className="text-emerald-700">{correct} ✓</span> · <span className="text-red-700">{incorrect} ✗</span>
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label="Session progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total} cards done`}
      >
        <div className="h-full rounded-full bg-indigo-600 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
