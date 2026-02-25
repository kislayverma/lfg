import React, {createContext, useContext, useMemo} from 'react';
import type {Theme, ThemeId} from './types';
import {neonGlassTheme} from './themes/neonGlass';
import {warmGradientTheme} from './themes/warmGradient';
import {monoBoldTheme} from './themes/monoBold';
import {useThemeStore} from '../stores/themeStore';

export const themes: Record<ThemeId, Theme> = {
  neonGlass: neonGlassTheme,
  warmGradient: warmGradientTheme,
  monoBold: monoBoldTheme,
};

const ThemeContext = createContext<Theme>(neonGlassTheme);

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const themeId = useThemeStore(s => s.themeId);
  const theme = useMemo(() => themes[themeId] ?? neonGlassTheme, [themeId]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
