import type { PropsWithChildren } from 'react';
import { useLayoutEffect } from 'react';
import type { SchoolProfile } from '../types/school';
import { SchoolThemeContext } from './SchoolThemeContext';

const applyThemeVariables = (school: SchoolProfile) => {
  const root = document.documentElement;

  root.style.setProperty('--school-primary', school.theme.primaryColor);
  root.style.setProperty('--school-secondary', school.theme.secondaryColor);
  root.style.setProperty('--school-accent', school.theme.accentColor);
};

export const ThemeProvider = ({
  school,
  children
}: PropsWithChildren<{ school: SchoolProfile }>) => {
  useLayoutEffect(() => {
    applyThemeVariables(school);
  }, [school]);

  return <SchoolThemeContext.Provider value={{ school }}>{children}</SchoolThemeContext.Provider>;
};
