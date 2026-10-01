import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="text-5xl font-bold text-indigo-600">404</p>
        <h1 className="mt-3 text-xl font-semibold">Page not found</h1>
        <Link to="/" className="mt-4 inline-block text-indigo-600 hover:underline">Go to your decks</Link>
      </div>
    </div>
  );
}
