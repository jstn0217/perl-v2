import type { PropsWithChildren } from 'react';
import { startTransition, useEffect, useState } from 'react';
import { fetchSession, login as loginRequest, logout as logoutRequest } from '../lib/api';
import { useTenantContext } from './TenantContext';
import { AuthProvider as AuthContextProvider } from './AuthContext';
import type { LoginFormValues } from './auth-context';
import type { SessionUser } from '../lib/api';

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const { activeSchool } = useTenantContext();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      setStatus('loading');
      setError(null);

      try {
        const sessionUser = await fetchSession();

        if (cancelled) {
          return;
        }

        startTransition(() => {
          if (sessionUser && sessionUser.schoolId === activeSchool.id) {
            setUser(sessionUser);
            setStatus('authenticated');
            return;
          }

          setUser(null);
          setStatus('unauthenticated');
        });
      } catch (sessionError) {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setUser(null);
          setStatus('unauthenticated');
          setError(sessionError instanceof Error ? sessionError.message : 'Unable to restore your session.');
        });
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [activeSchool.id]);

  const login = async ({ email, password }: LoginFormValues) => {
    setError(null);
    setStatus('loading');

    try {
      await loginRequest({
        email,
        password,
        schoolSlug: activeSchool.slug
      });

      const sessionUser = await fetchSession();

      if (!sessionUser || sessionUser.schoolId !== activeSchool.id) {
        throw new Error('Your session was not created for the selected school.');
      }

      startTransition(() => {
        setUser(sessionUser);
        setStatus('authenticated');
      });
    } catch (loginError) {
      startTransition(() => {
        setUser(null);
        setStatus('unauthenticated');
        setError(
          loginError instanceof Error ? loginError.message : 'Unable to sign in with those credentials.'
        );
      });

      throw loginError;
    }
  };

  const logout = async () => {
    setError(null);

    try {
      await logoutRequest();
    } finally {
      startTransition(() => {
        setUser(null);
        setStatus('unauthenticated');
      });
    }
  };

  return (
    <AuthContextProvider
      value={{
        user,
        status,
        error,
        login,
        logout,
        clearError: () => setError(null)
      }}
    >
      {children}
    </AuthContextProvider>
  );
};
