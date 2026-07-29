import type { PropsWithChildren } from 'react';
import { startTransition, useEffect, useState } from 'react';
import {
  fetchSession,
  fetchSupportSchools,
  login as loginRequest,
  logout as logoutRequest
} from '../lib/api';
import { useTenantContext } from './TenantContext';
import { AuthProvider as AuthContextProvider } from './AuthContext';
import type { LoginFormValues } from './auth-context';
import type { SessionUser } from '../lib/api';
import { isPlatformUser } from '../lib/permissions';

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const { resetPublicSchool, setAuthenticatedSchool } = useTenantContext();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      setStatus('loading');
      setError(null);

      try {
        const session = await fetchSession();

        if (cancelled) return;

        if (!session) {
          resetPublicSchool();
          startTransition(() => {
            setUser(null);
            setStatus('unauthenticated');
          });
          return;
        }

        if (session?.school) {
          setAuthenticatedSchool(session.school);
        } else if (isPlatformUser(session?.user.role)) {
          const schools = await fetchSupportSchools();
          if (!cancelled && schools[0]) setAuthenticatedSchool(schools[0], schools);
        }

        if (cancelled) return;
        startTransition(() => {
          setUser(session.user);
          setStatus('authenticated');
        });
      } catch (sessionError) {
        if (cancelled) return;

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
  }, [resetPublicSchool, setAuthenticatedSchool]);

  const login = async ({ email, password }: LoginFormValues) => {
    setError(null);
    setStatus('loading');

    try {
      const session = await loginRequest({ email, password });
      let availableSchools = session.school ? [session.school] : [];
      let school = session.school;

      if (isPlatformUser(session.user.role)) {
        availableSchools = await fetchSupportSchools();
        school = availableSchools[0] ?? null;
      }

      if (school) setAuthenticatedSchool(school, availableSchools);

      startTransition(() => {
        setUser(session.user);
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
      resetPublicSchool();
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
