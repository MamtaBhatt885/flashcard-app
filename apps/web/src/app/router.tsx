import { createBrowserRouter } from 'react-router';
import { RequireAuth, RedirectIfAuthed } from '../features/auth';
import { AppLayout } from '../components/ui/AppLayout';
import { LoginPage } from '../pages/LoginPage';
import { SignupPage } from '../pages/SignupPage';
import { DeckListPage } from '../pages/DeckListPage';
import { DeckPage } from '../pages/DeckPage';
import { StudySessionPage } from '../pages/StudySessionPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    element: <RedirectIfAuthed />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DeckListPage /> },
          { path: '/decks/:deckId', element: <DeckPage /> },
          { path: '/decks/:deckId/study', element: <StudySessionPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
