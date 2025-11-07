import Dexie, { type Table } from "dexie";

import type { TxnCreateInput } from "@/lib/validators";

export interface TxnDraft {
  id?: number;
  createdAt: Date;
  payload: unknown;
}

class GFinanceDatabase extends Dexie {
  public txnDrafts!: Table<TxnDraft, number>;
  public txnQueue!: Table<TxnQueueItem, number>;

  constructor() {
    super("gfinance");

    this.version(1).stores({
      txnDrafts: "++id, createdAt",
    });

    this.version(2).stores({
      txnDrafts: "++id, createdAt",
      txnQueue: "++id, synced, createdAt",
    });
  }
}

export const db = new GFinanceDatabase();

export type QueuedTxnPayload = TxnCreateInput & { clientRef: string };

export interface TxnQueueItem {
  id?: number;
  payload: QueuedTxnPayload;
  createdAt: Date;
  synced: boolean;
}
