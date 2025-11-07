"use client";

import { db, type QueuedTxnPayload } from "@/lib/db";
import type { TxnCreateInput } from "@/lib/validators";

export const TXN_QUEUE_EVENT = "gf:txn-queue-updated";

export function createClientRef() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `offline-${crypto.randomUUID()}`;
  }
  return `offline-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function dispatchQueueEvent() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TXN_QUEUE_EVENT));
  }
}

export async function enqueueOfflineTransaction(input: TxnCreateInput): Promise<QueuedTxnPayload> {
  const payload: QueuedTxnPayload = {
    ...input,
    clientRef: input.clientRef && input.clientRef.trim().length > 0 ? input.clientRef : createClientRef(),
  };

  await db.txnQueue.add({
    payload: { ...payload },
    createdAt: new Date(),
    synced: false,
  });

  dispatchQueueEvent();
  return payload;
}

export type { QueuedTxnPayload };
