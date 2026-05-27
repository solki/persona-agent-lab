/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface NotificationState {
  totalCount: number;
  refresh: () => void;
}

const NotificationContext = createContext<NotificationState>({ totalCount: 0, refresh: () => {} });

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [totalCount, setTotalCount] = useState(0);

  const refresh = useCallback(() => {
    api.getProposedMemoryNotifications().then(
      (summary) => setTotalCount(summary.total_count),
      () => {} // silently ignore fetch errors
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <NotificationContext.Provider value={{ totalCount, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  return useContext(NotificationContext);
}
