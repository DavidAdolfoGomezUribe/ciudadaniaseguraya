import { create } from "zustand";

const MAX_NOTIFICATIONS = 40;

export const useAdminRealtimeStore = create((set) => ({
  status: "connecting",
  notifications: [],
  lastEventId: null,
  setStatus: (status) => set({ status }),
  receive(event) {
    set((state) => ({
      lastEventId: event.id || state.lastEventId,
      notifications: [
        { ...event, receivedAt: new Date().toISOString() },
        ...state.notifications,
      ].slice(0, MAX_NOTIFICATIONS),
    }));
  },
  clear: () => set({ notifications: [] }),
}));
