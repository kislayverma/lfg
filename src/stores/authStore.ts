import {create} from 'zustand';
import {createMMKV} from 'react-native-mmkv';
import {database, User} from '../database';
import {Q} from '@nozbe/watermelondb';

const storage = createMMKV();

const CURRENT_USER_ID_KEY = 'current_user_id';

interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hydrate: () => Promise<void>;
  signup: (phone: string, name: string) => Promise<{success: boolean; error?: string}>;
  login: (phone: string) => Promise<{success: boolean; error?: string}>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  isAuthenticated: false,
  isLoading: true,

  hydrate: async () => {
    const userId = storage.getString(CURRENT_USER_ID_KEY);
    if (!userId) {
      set({isLoading: false, currentUser: null, isAuthenticated: false});
      return;
    }

    try {
      const user = await database.get<User>('users').find(userId);
      set({currentUser: user, isAuthenticated: true, isLoading: false});
    } catch {
      // User record not found — clear stale session
      storage.remove(CURRENT_USER_ID_KEY);
      set({isLoading: false, currentUser: null, isAuthenticated: false});
    }
  },

  signup: async (phone: string, name: string) => {
    const trimmedPhone = phone.trim();
    const trimmedName = name.trim();

    if (!trimmedPhone || !trimmedName) {
      return {success: false, error: 'Name and phone number are required'};
    }

    // Check if phone already taken
    const existing = await database
      .get<User>('users')
      .query(Q.where('phone', trimmedPhone))
      .fetch();

    if (existing.length > 0) {
      return {success: false, error: 'This phone number is already registered'};
    }

    let user: User;
    await database.write(async () => {
      user = await database.get<User>('users').create(u => {
        u.phone = trimmedPhone;
        u.name = trimmedName;
      });
    });

    storage.set(CURRENT_USER_ID_KEY, user!.id);
    set({currentUser: user!, isAuthenticated: true});
    return {success: true};
  },

  login: async (phone: string) => {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      return {success: false, error: 'Phone number is required'};
    }

    const results = await database
      .get<User>('users')
      .query(Q.where('phone', trimmedPhone))
      .fetch();

    if (results.length === 0) {
      return {success: false, error: 'No account found with this phone number'};
    }

    const user = results[0];
    storage.set(CURRENT_USER_ID_KEY, user.id);
    set({currentUser: user, isAuthenticated: true});
    return {success: true};
  },

  logout: () => {
    storage.remove(CURRENT_USER_ID_KEY);
    set({currentUser: null, isAuthenticated: false});
  },
}));
