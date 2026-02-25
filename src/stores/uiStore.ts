import {create} from 'zustand';

interface UIState {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  currentMonth: number;
  currentYear: number;
  setCurrentMonth: (month: number, year: number) => void;
  isLogModalVisible: boolean;
  setLogModalVisible: (visible: boolean) => void;
  isScheduleModalVisible: boolean;
  setScheduleModalVisible: (visible: boolean) => void;
  toastMessage: string | null;
  showToast: (message: string) => void;
  hideToast: () => void;
  confettiVisible: boolean;
  confettiMessage: string | null;
  showConfetti: (message: string) => void;
  hideConfetti: () => void;
  // Streak celebration popup
  celebrationVisible: boolean;
  celebrationStreak: number;
  showCelebration: (streak: number) => void;
  hideCelebration: () => void;
}

const now = new Date();

export const useUIStore = create<UIState>(set => ({
  selectedDate: now,
  setSelectedDate: (date: Date) => set({selectedDate: date}),
  currentMonth: now.getMonth(),
  currentYear: now.getFullYear(),
  setCurrentMonth: (month: number, year: number) =>
    set({currentMonth: month, currentYear: year}),
  isLogModalVisible: false,
  setLogModalVisible: (visible: boolean) => set({isLogModalVisible: visible}),
  isScheduleModalVisible: false,
  setScheduleModalVisible: (visible: boolean) =>
    set({isScheduleModalVisible: visible}),
  toastMessage: null,
  showToast: (message: string) => {
    set({toastMessage: message});
    setTimeout(() => set({toastMessage: null}), 3000);
  },
  hideToast: () => set({toastMessage: null}),
  confettiVisible: false,
  confettiMessage: null,
  showConfetti: (message: string) => {
    set({confettiVisible: true, confettiMessage: message});
  },
  hideConfetti: () => set({confettiVisible: false, confettiMessage: null}),
  celebrationVisible: false,
  celebrationStreak: 0,
  showCelebration: (streak: number) => {
    set({celebrationVisible: true, celebrationStreak: streak});
  },
  hideCelebration: () => set({celebrationVisible: false, celebrationStreak: 0}),
}));
