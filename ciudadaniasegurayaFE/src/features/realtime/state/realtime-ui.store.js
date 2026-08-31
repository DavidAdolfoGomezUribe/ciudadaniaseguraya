import { create } from "zustand";

const MAX_NOTIFICATIONS = 30;

export const useRealtimeUiStore = create((set) => ({
  status: "connecting",
  lastEventId: null,
  notifications: [],
  setStatus: (status) => set({ status }),
  setLastEventId: (lastEventId) => set({ lastEventId }),
  addNotification(notification) {
    set((state) => ({
      notifications: [
        { ...notification, receivedAt: new Date().toISOString() },
        ...state.notifications,
      ].slice(0, MAX_NOTIFICATIONS),
    }));
  },
  clearNotifications: () => set({ notifications: [] }),
}));
