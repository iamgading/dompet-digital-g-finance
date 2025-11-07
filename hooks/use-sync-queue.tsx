"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { createTransaction } from "@/app/actions/finance";
import { db } from "@/lib/db";
import type { QueuedTxnPayload } from "@/lib/offline-queue";
import { TXN_QUEUE_EVENT } from "@/lib/offline-queue";

type SyncQueueState = {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  lastError: string | null;
};

const SyncQueueContext = createContext<SyncQueueState | null>(null);

const initialState: SyncQueueState = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  syncing: false,
  pendingCount: 0,
  lastError: null,
};

async function fetchPendingCount() {
  return db.txnQueue.filter((entry) => !entry.synced).count();
}

export function SyncQueueProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const state = useProvideSyncQueue({
    onSynced: () => {
      router.refresh();
    },
  });

  const value = useMemo(() => state, [state]);

  return <SyncQueueContext.Provider value={value}>{children}</SyncQueueContext.Provider>;
}

export function useSyncQueue() {
  const context = useContext(SyncQueueContext);
  if (!context) {
    throw new Error("useSyncQueue must be used within a SyncQueueProvider");
  }
  return context;
}

function useProvideSyncQueue({ onSynced }: { onSynced?: () => void }) {
  const [state, setState] = useState<SyncQueueState>(initialState);
  const syncInFlight = useRef(false);
  const hasMounted = useRef(false);

  const updateOnlineState = useCallback((online: boolean) => {
    setState((prev) => ({ ...prev, online }));
  }, []);

  const refreshPending = useCallback(async () => {
    try {
      const count = await fetchPendingCount();
      setState((prev) => ({ ...prev, pendingCount: count }));
      return count;
    } catch (error) {
      console.error("[sync-queue] gagal mendapatkan jumlah antrian", error);
      setState((prev) => ({ ...prev, lastError: "Gagal memuat status sinkronisasi." }));
      return 0;
    }
  }, []);

  const runSync = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      updateOnlineState(false);
      return;
    }

    if (syncInFlight.current) return;
    syncInFlight.current = true;
    setState((prev) => ({ ...prev, syncing: true, online: true, lastError: null }));

    try {
      const pending = await db.txnQueue.filter((entry) => !entry.synced).sortBy("createdAt");
      if (pending.length === 0) {
        await refreshPending();
        return;
      }

      const processedIds: number[] = [];
      for (const entry of pending) {
        try {
          const result = await createTransaction(entry.payload as QueuedTxnPayload);
          if (result.success) {
            if (entry.id != null) {
              await db.txnQueue.update(entry.id, { synced: true });
              processedIds.push(entry.id);
            }
          } else {
            setState((prev) => ({ ...prev, lastError: result.error }));
            break;
          }
        } catch (error) {
          console.error("[sync-queue] gagal sinkronisasi transaksi", error);
          setState((prev) => ({
            ...prev,
            lastError: error instanceof Error ? error.message : "Sinkronisasi gagal.",
          }));
          break;
        }
      }

      if (processedIds.length > 0) {
        await db.txnQueue.bulkDelete(processedIds);
        await refreshPending();
        onSynced?.();
      }
    } finally {
      syncInFlight.current = false;
      setState((prev) => ({
        ...prev,
        syncing: false,
        online: typeof navigator === "undefined" ? prev.online : navigator.onLine,
      }));
    }
  }, [onSynced, refreshPending, updateOnlineState]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      updateOnlineState(typeof navigator === "undefined" ? true : navigator.onLine);
      void refreshPending();
      if (typeof navigator !== "undefined" && navigator.onLine) {
        void runSync();
      }
    }
  }, [refreshPending, runSync, updateOnlineState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => {
      updateOnlineState(true);
      void runSync();
    };
    const handleOffline = () => {
      updateOnlineState(false);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(TXN_QUEUE_EVENT, refreshPending);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(TXN_QUEUE_EVENT, refreshPending);
    };
  }, [refreshPending, runSync, updateOnlineState]);

  return state;
}
