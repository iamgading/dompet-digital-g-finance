import { createHash, randomUUID } from "node:crypto";

import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";
import { getTotalBalance, mapPocketRow, type PocketRecord } from "@/lib/repo/pockets";
import type { TransactionFilterInput, TransferInput, TxnCreateInput } from "@/lib/validators";

type PocketRow = Database["public"]["Tables"]["Pocket"]["Row"];
type TransactionRow = Database["public"]["Tables"]["Transaction"]["Row"];

export type TransactionRecord = {
  id: string;
  type: string;
  amount: number;
  date: Date;
  note: string | null;
  pocketId: string;
  source: string | null;
  externalRef: string | null;
  profileId: string;
  createdAt: Date;
  updatedAt: Date;
};

type TransactionWithPocket = TransactionRecord & {
  pocket: {
    id: string;
    name: string;
    color: string | null;
  };
};

export function mapTransactionRow(row: TransactionRow): TransactionRecord {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    date: new Date(row.date),
    note: row.note,
    pocketId: row.pocketId,
    source: row.source,
    externalRef: row.externalRef,
    profileId: row.profileId,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

async function fetchPocketOrThrow(pocketId: string): Promise<PocketRow> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("Pocket").select("*").eq("id", pocketId).maybeSingle();
  if (error) {
    throw new Error(`Gagal memuat pocket: ${error.message}`);
  }
  if (!data) {
    throw new Error("Pocket tidak ditemukan.");
  }
  return data;
}

async function ensurePocketOwnership(pocketId: string, profileId: string) {
  const pocket = await fetchPocketOrThrow(pocketId);
  if (pocket.profileId !== profileId) {
    throw new Error("Pocket tidak ditemukan pada profil aktif.");
  }
  return pocket;
}

export async function savePocketBalance(pocketId: string, balance: number) {
  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("Pocket")
    .update({ balance, updatedAt: nowIso })
    .eq("id", pocketId)
    .select()
    .single();

  if (error) {
    throw new Error(`Gagal memperbarui saldo pocket: ${error.message}`);
  }

  return data;
}

export async function insertTransactionRow(payload: Partial<TransactionRow>) {
  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  if (!payload.type || !payload.pocketId || !payload.profileId) {
    throw new Error("Field transaksi wajib: type, pocketId, profileId.");
  }
  const transactionDate = payload.date ?? nowIso;
  const row: TransactionRow = {
    id: payload.id ?? randomUUID(),
    type: payload.type,
    amount: payload.amount ?? 0,
    date: transactionDate,
    note: payload.note ?? null,
    pocketId: payload.pocketId,
    source: payload.source ?? null,
    externalRef: payload.externalRef ?? null,
    profileId: payload.profileId,
    createdAt: payload.createdAt ?? nowIso,
    updatedAt: payload.updatedAt ?? nowIso,
  };

  const { data, error } = await supabase.from("Transaction").insert(row).select().single();
  if (error) {
    throw new Error(`Gagal membuat transaksi: ${error.message}`);
  }
  return data;
}

export async function createTransaction(input: TxnCreateInput, profileId: string) {
  const { amount, type, pocketId, note, date, clientRef } = input;
  const supabase = getSupabaseAdminClient();
  const pocket = await ensurePocketOwnership(pocketId, profileId);

  if (clientRef) {
    const { data: existing, error: findError } = await supabase
      .from("Transaction")
      .select("*")
      .eq("pocketId", pocketId)
      .eq("profileId", profileId)
      .eq("externalRef", clientRef)
      .limit(1)
      .maybeSingle();

    if (findError && findError.code !== "PGRST116") {
      throw new Error(`Gagal memeriksa transaksi duplikat: ${findError.message}`);
    }

    if (existing) {
      const currentPocket = await fetchPocketOrThrow(pocketId);
      const total = await getTotalBalance(profileId);
      return {
        transaction: mapTransactionRow(existing),
        pocket: mapPocketRow(currentPocket),
        total,
      };
    }
  }

  const delta = type === "income" ? amount : -amount;
  const targetDate = date ?? new Date();

  const transaction = await insertTransactionRow({
    type,
    amount,
    pocketId,
    profileId,
    note: note ?? null,
    date: targetDate.toISOString(),
    source: "manual",
    externalRef: clientRef ?? null,
  });

  const updatedPocketRow = await savePocketBalance(pocketId, pocket.balance + delta);
  const total = await getTotalBalance(profileId);

  return {
    transaction: mapTransactionRow(transaction),
    pocket: mapPocketRow(updatedPocketRow),
    total,
  };
}

export async function listTransactions(filter: TransactionFilterInput, profileId: string) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("Transaction")
    .select("*, pocket:Pocket(id,name,color)")
    .eq("profileId", profileId);

  if (filter.pocketId) {
    query = query.eq("pocketId", filter.pocketId);
  }

  if (filter.type && filter.type !== "transfer") {
    query = query.eq("type", filter.type);
  } else if (filter.type === "transfer") {
    query = query.eq("source", "transfer");
  }

  query = query.order("date", { ascending: filter.order === "asc" });

  if (filter.limit) {
    query = query.limit(filter.limit);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Gagal memuat transaksi: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const { pocket, ...rest } = row as unknown as TransactionRow & {
      pocket: { id: string; name: string; color: string | null };
    };
    const base = mapTransactionRow(rest as TransactionRow);
    return {
      ...base,
      pocket,
    } satisfies TransactionWithPocket;
  });
}

export async function transferBetweenPockets(input: TransferInput, profileId: string) {
  const { fromId, toId, amount, note } = input;

  if (fromId === toId) {
    throw new Error("Pocket asal dan tujuan harus berbeda.");
  }

  const fromPocket = await ensurePocketOwnership(fromId, profileId);
  const toPocket = await ensurePocketOwnership(toId, profileId);

  const now = new Date();
  const expenseNote = note ? `${note} (ke ${toPocket.name})` : `Transfer ke ${toPocket.name}`;
  const incomeNote = note ? `${note} (dari ${fromPocket.name})` : `Transfer dari ${fromPocket.name}`;

  const expenseTxn = await insertTransactionRow({
    type: "expense",
    amount,
    pocketId: fromId,
    profileId,
    note: expenseNote,
    date: now.toISOString(),
    source: "transfer",
  });

  const incomeTxn = await insertTransactionRow({
    type: "income",
    amount,
    pocketId: toId,
    profileId,
    note: incomeNote,
    date: now.toISOString(),
    source: "transfer",
  });

  const updatedFromRow = await savePocketBalance(fromId, fromPocket.balance - amount);
  const updatedToRow = await savePocketBalance(toId, toPocket.balance + amount);
  const total = await getTotalBalance(profileId);

  return {
    fromPocket: mapPocketRow(updatedFromRow),
    toPocket: mapPocketRow(updatedToRow),
    transactions: [mapTransactionRow(expenseTxn), mapTransactionRow(incomeTxn)],
    total,
  };
}

export type ImportRow = {
  description: string;
  note?: string;
  pocketId: string;
  externalRef?: string;
  date: Date;
  type: "income" | "expense";
  amount: number;
};

function hashRow(row: { description: string; date: Date; amount: number; pocketId: string }) {
  const formattedDate = row.date.toISOString().slice(0, 10);
  const hash = createHash("sha1");
  hash.update([row.pocketId, formattedDate, row.description.toLowerCase(), Math.abs(row.amount)].join("|"));
  return hash.digest("hex");
}

function getWindow(date: Date, days: number) {
  const windowDate = new Date(date);
  windowDate.setDate(windowDate.getDate() + days);
  return windowDate;
}

export async function importTransactions(rows: ImportRow[], profileId: string) {
  const created: ImportRow[] = [];
  const duplicates: Array<{ externalRef: string; description: string }> = [];
  const failures: Array<{ description: string; reason: string }> = [];

  for (const row of rows) {
    try {
      const pocket = await ensurePocketOwnership(row.pocketId, profileId);

      const ref =
        row.externalRef && row.externalRef.trim().length > 0 ? row.externalRef.trim() : hashRow(row);
      const windowStart = getWindow(row.date, -30);
      const windowEnd = getWindow(row.date, 30);

      const supabase = getSupabaseAdminClient();
      const { data: duplicate, error: duplicateError } = await supabase
        .from("Transaction")
        .select("id")
        .eq("pocketId", row.pocketId)
        .eq("externalRef", ref)
        .gte("date", windowStart.toISOString())
        .lte("date", windowEnd.toISOString())
        .limit(1)
        .maybeSingle();

      if (duplicateError && duplicateError.code !== "PGRST116") {
        throw new Error(`Gagal memeriksa duplikasi: ${duplicateError.message}`);
      }

      if (duplicate) {
        duplicates.push({ externalRef: ref, description: row.description });
        continue;
      }

      const amountMagnitude = Math.abs(row.amount);
      const delta = row.type === "income" ? amountMagnitude : -amountMagnitude;

      const transaction = await insertTransactionRow({
        type: row.type,
        amount: amountMagnitude,
        pocketId: row.pocketId,
        profileId,
        note: row.note ?? row.description,
        date: row.date.toISOString(),
        source: "import",
        externalRef: ref,
      });

      await savePocketBalance(row.pocketId, pocket.balance + delta);
      pocket.balance += delta;

      created.push({
        ...row,
        externalRef: ref,
        amount: amountMagnitude,
        type: row.type,
        date: new Date(transaction.date),
      });
    } catch (error) {
      failures.push({
        description: row.description,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const total = await getTotalBalance(profileId);

  return {
    created,
    duplicates,
    failures,
    total,
  };
}

export async function deleteTransactionById(id: string, profileId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: transaction, error: findError } = await supabase
    .from("Transaction")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (findError) {
    throw new Error(`Gagal memuat transaksi: ${findError.message}`);
  }

  if (!transaction || transaction.profileId !== profileId) {
    throw new Error("Transaksi tidak ditemukan pada profil aktif.");
  }

  const pocket = await ensurePocketOwnership(transaction.pocketId, profileId);

  const { error: deleteError } = await supabase.from("Transaction").delete().eq("id", id);
  if (deleteError) {
    throw new Error(`Gagal menghapus transaksi: ${deleteError.message}`);
  }

  const balanceDelta = transaction.type === "income" ? -transaction.amount : transaction.amount;
  const updatedPocketRow = await savePocketBalance(transaction.pocketId, pocket.balance + balanceDelta);
  const total = await getTotalBalance(profileId);

  return {
    pocket: mapPocketRow(updatedPocketRow),
    total,
  };
}
