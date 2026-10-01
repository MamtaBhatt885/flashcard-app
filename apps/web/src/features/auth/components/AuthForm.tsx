import { zodResolver } from '@hookform/resolvers/zod';
import { credentialsSchema, type CredentialsInput } from '@flashcards/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { FormError, TextField } from '../../../components/ui/Field';
import { errorMessage } from '../../../lib/errors';
import { keys } from '../../../lib/queryKeys';
import { useLogin, useSignup } from '../hooks';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const login = useLogin();
  const signup = useSignup();
  const mutation = mode === 'login' ? login : signup;
  const sessionExpired = useQueryClient().getQueryData<boolean>(keys.sessionExpired) === true;
  const { register, handleSubmit, formState: { errors } } = useForm<CredentialsInput>({
    resolver: zodResolver(credentialsSchema),
  });

  const isLogin = mode === 'login';

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span aria-hidden className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-indigo-600 text-xl font-bold text-white">F</span>
          <h1 className="text-2xl font-semibold">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-1 text-sm text-slate-500">{isLogin ? 'Sign in to keep studying' : 'Start building your decks'}</p>
        </div>
        <form
          noValidate
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          {sessionExpired && !mutation.error && (
            <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Your session expired. Please sign in again.
            </p>
          )}
          <FormError message={mutation.error && errorMessage(mutation.error)} />
          <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <TextField
            label="Password"
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            error={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" className="w-full" loading={mutation.isPending}>
            {isLogin ? 'Sign in' : 'Sign up'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          {isLogin ? 'New here? ' : 'Already have an account? '}
          <Link to={isLogin ? '/signup' : '/login'} className="font-medium text-indigo-600 hover:underline">
            {isLogin ? 'Create an account' : 'Sign in'}
          </Link>
        </p>
      </div>
    </div>
  );
}
