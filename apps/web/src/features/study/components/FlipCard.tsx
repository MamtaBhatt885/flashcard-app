import clsx from 'clsx';

interface Props {
  front: string;
  back: string;
  flipped: boolean;
  onFlip: () => void;
}

export function FlipCard({ front, back, flipped, onFlip }: Props) {
  const face = 'flip-face flex flex-col rounded-3xl p-8 shadow-lg ring-1';
  return (
    <button
      type="button"
      onClick={onFlip}
      aria-label={flipped ? 'Flip card back to the question' : 'Flip card to see the answer'}
      className="flip-scene block h-72 w-full text-left focus-visible:outline-none sm:h-80"
    >
      <div className={clsx('flip-inner h-full', flipped && 'is-flipped')}>
        <div className={clsx(face, 'bg-white ring-slate-200')} aria-hidden={flipped}>
          <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">Question</span>
          <p className="m-auto text-center text-xl whitespace-pre-wrap sm:text-2xl">{front}</p>
          <span className="text-center text-xs text-slate-400">Click or press Space to reveal</span>
        </div>
        <div className={clsx(face, 'flip-back bg-indigo-50 ring-indigo-200')} aria-hidden={!flipped}>
          <span className="text-xs font-medium tracking-wide text-indigo-500 uppercase">Answer</span>
          <p className="m-auto text-center text-xl whitespace-pre-wrap sm:text-2xl">{back}</p>
        </div>
      </div>
    </button>
  );
}
