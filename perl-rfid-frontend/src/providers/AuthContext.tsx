import type { PropsWithChildren } from 'react';
import { AuthContext } from './auth-context';
import type { AuthContextValue } from './auth-context';

export const AuthProvider = ({
  children,
  value
}: PropsWithChildren<{ value: AuthContextValue }>) => {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
