import { Link, Outlet } from 'react-router';
import { useLogout, useMe } from '../../features/auth';
import { Button } from './Button';

export function AppLayout() {
  const { data: user } = useMe();
  const logout = useLogout();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <span aria-hidden className="grid size-7 place-items-center rounded-md bg-indigo-600 text-sm text-white">F</span>
            Flashcards
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">{user?.email}</span>
            <Button variant="ghost" onClick={() => logout.mutate()} loading={logout.isPending}>Log out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
