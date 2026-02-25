import {create} from 'zustand';
import {createMMKV} from 'react-native-mmkv';
import type {ThemeId} from '../theme/types';

const storage = createMMKV();
const THEME_KEY = 'selected_theme';

interface ThemeState {
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
}

export const useThemeStore = create<ThemeState>(set => ({
  themeId: (storage.getString(THEME_KEY) as ThemeId) || 'neonGlass',
  setThemeId: (id: ThemeId) => {
    storage.set(THEME_KEY, id);
    set({themeId: id});
  },
}));
