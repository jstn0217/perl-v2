import { createContext, useContext } from 'react';
import type { SchoolProfile } from '../types/school';

interface ThemeContextValue {
  school: SchoolProfile;
}

export const SchoolThemeContext = createContext<ThemeContextValue | null>(null);

export const useSchoolTheme = () => {
  const context = useContext(SchoolThemeContext);

  if (!context) {
    throw new Error('useSchoolTheme must be used within ThemeProvider.');
  }

  return context;
};
