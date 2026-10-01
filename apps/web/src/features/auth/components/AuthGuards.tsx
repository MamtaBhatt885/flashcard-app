import { Navigate, Outlet, useLocation } from 'react-router';
import { Spinner } from '../../../components/ui/Feedback';
import { useMe } from '../hooks';

export function RequireAuth() {
  const { data: user, isPending } = useMe();
  const location = useLocation();
  if (isPending) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function RedirectIfAuthed() {
  const { data: user, isPending } = useMe();
  const location = useLocation();
  if (isPending) return <Spinner />;
  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;
  return <Outlet />;
}
