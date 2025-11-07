import { randomUUID } from "node:crypto";

import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  getNextRun,
  parseSchedule,
  serializeSchedule,
  type RecurringSchedule,
} from "@/lib/schedule";
import { getTotalBalance, mapPocketRow, type PocketRecord } from "@/lib/repo/pockets";
import { insertTransactionRow, mapTransactionRow, savePocketBalance } from "@/lib/repo/transactions";
import type { Database } from "@/lib/supabase";

export interface RecurringInput {
  id?: string;
  name: string;
  type: "income" | "expense";
  amount: number;
  pocketId: string;
  schedule: RecurringSchedule;
  autoPost?: boolean;
  nextRunAt?: Date;
}

type RecurringRow = Database["public"]["Tables"]["Recurring"]["Row"];

type RecurringRecord = {
  id: string;
  name: string;
  type: "income" | "expense";
  amount: number;
  pocketId: string;
  schedule: string;
  nextRunAt: Date;
  lastRunAt: Date | null;
  autoPost: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function mapRecurringRow(row: RecurringRow): RecurringRecord {
  return {
    id: row.id,
    name: row.name,
    type: row.type as "income" | "expense",
    amount: row.amount,
    pocketId: row.pocketId,
    schedule: row.schedule,
    nextRunAt: new Date(row.nextRunAt),
    lastRunAt: row.lastRunAt ? new Date(row.lastRunAt) : null,
    autoPost: row.autoPost,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

async function fetchPocket(pocketId: string): Promise<PocketRecord> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("Pocket")
    .select("*")
    .eq("id", pocketId)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal memuat pocket: ${error.message}`);
  }

  if (!data) {
    throw new Error("Pocket tidak ditemukan.");
  }

  return mapPocketRow(data);
}

async function ensurePocketOwnership(pocketId: string, profileId: string) {
  const pocket = await fetchPocket(pocketId);
  if (pocket.profileId !== profileId) {
    throw new Error("Pocket tidak ditemukan pada profil aktif.");
  }
  return pocket;
}

export async function listRecurring(profileId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: pocketRows, error: pocketError } = await supabase
    .from("Pocket")
    .select("id,name,color,profileId")
    .eq("profileId", profileId);

  if (pocketError) {
    throw new Error(`Gagal memuat pocket untuk recurring: ${pocketError.message}`);
  }

  const pockets = pocketRows ?? [];
  if (pockets.length === 0) {
    return [];
  }

  const pocketMap = new Map<string, { id: string; name: string; color: string | null }>();
  for (const row of pockets) {
    pocketMap.set(row.id, {
      id: row.id,
      name: row.name,
      color: row.color,
    });
  }

  const { data, error } = await supabase
    .from("Recurring")
    .select("*")
    .in(
      "pocketId",
      pockets.map((p) => p.id),
    )
    .order("nextRunAt", { ascending: true })
    .order("createdAt", { ascending: true });

  if (error) {
    throw new Error(`Gagal memuat recurring: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const recurring = mapRecurringRow(row);
    const pocket = pocketMap.get(recurring.pocketId);
    if (!pocket) {
      throw new Error("Pocket untuk recurring tidak ditemukan.");
    }
    return {
      ...recurring,
      pocket,
    };
  });
}

export async function upsertRecurring(input: RecurringInput, profileId: string) {
  const scheduleString = serializeSchedule(input.schedule);
  const now = new Date();
  const initialNextRun =
    input.nextRunAt instanceof Date ? input.nextRunAt : getNextRun(now, input.schedule);

  const supabase = getSupabaseAdminClient();
  const targetPocket = await ensurePocketOwnership(input.pocketId, profileId);
  const nowIso = now.toISOString();
  const nextRunIso = initialNextRun.toISOString();

  if (input.id) {
    const { data: existing, error: existingError } = await supabase
      .from("Recurring")
      .select("pocketId")
      .eq("id", input.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Gagal memeriksa recurring: ${existingError.message}`);
    }

    if (!existing) {
      throw new Error("Recurring tidak ditemukan pada profil aktif.");
    }

    await ensurePocketOwnership(existing.pocketId, profileId);

    const { data, error } = await supabase
      .from("Recurring")
      .update({
        name: input.name,
        type: input.type,
        amount: input.amount,
        pocketId: targetPocket.id,
        schedule: scheduleString,
        nextRunAt: nextRunIso,
        autoPost: input.autoPost ?? true,
        updatedAt: nowIso,
      })
      .eq("id", input.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Gagal memperbarui recurring: ${error.message}`);
    }

    return {
      ...mapRecurringRow(data),
      pocket: {
        id: targetPocket.id,
        name: targetPocket.name,
        color: targetPocket.color,
      },
    };
  }

  const { data, error } = await supabase
    .from("Recurring")
    .insert({
      id: randomUUID(),
      name: input.name,
      type: input.type,
      amount: input.amount,
      pocketId: targetPocket.id,
      schedule: scheduleString,
      nextRunAt: nextRunIso,
      autoPost: input.autoPost ?? true,
      createdAt: nowIso,
      updatedAt: nowIso,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Gagal membuat recurring: ${error.message}`);
  }

  return {
    ...mapRecurringRow(data),
    pocket: {
      id: targetPocket.id,
      name: targetPocket.name,
      color: targetPocket.color,
    },
  };
}

export async function deleteRecurring(id: string, profileId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: recurring, error: lookupError } = await supabase
    .from("Recurring")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Gagal memuat recurring: ${lookupError.message}`);
  }

  if (!recurring) {
    throw new Error("Recurring tidak ditemukan pada profil aktif.");
  }

  await ensurePocketOwnership(recurring.pocketId, profileId);

  const { data, error } = await supabase.from("Recurring").delete().eq("id", id).select().single();
  if (error) {
    throw new Error(`Gagal menghapus recurring: ${error.message}`);
  }

  return mapRecurringRow(data);
}

export async function runRecurringNow(recurringId: string, profileId: string) {
  const supabase = getSupabaseAdminClient();

  const { data: recurringRow, error } = await supabase
    .from("Recurring")
    .select("*")
    .eq("id", recurringId)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal memuat recurring: ${error.message}`);
  }
  if (!recurringRow) {
    throw new Error("Recurring tidak ditemukan.");
  }

  const pocket = await ensurePocketOwnership(recurringRow.pocketId, profileId);

  const schedule = parseSchedule(recurringRow.schedule);
  const runAt = new Date();
  const nextRunAt = getNextRun(runAt, schedule);
  const amountAbs = Math.abs(recurringRow.amount);
  const delta = recurringRow.type === "income" ? amountAbs : -amountAbs;

  const transactionRow = await insertTransactionRow({
    type: recurringRow.type,
    amount: amountAbs,
    pocketId: recurringRow.pocketId,
    date: runAt.toISOString(),
    note: `[Recurring] ${recurringRow.name}`,
    source: "recurring",
    externalRef: `recurring:${recurringRow.id}:${runAt.toISOString()}`,
    profileId: pocket.profileId,
  });

  const updatedPocketRow = await savePocketBalance(pocket.id, pocket.balance + delta);

  const { data: updatedRecurringRow, error: updateError } = await supabase
    .from("Recurring")
    .update({
      lastRunAt: runAt.toISOString(),
      nextRunAt: nextRunAt.toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", recurringRow.id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Gagal memperbarui recurring: ${updateError.message}`);
  }

  const total = await getTotalBalance(profileId);

  return {
    transaction: mapTransactionRow(transactionRow),
    pocket: mapPocketRow(updatedPocketRow),
    recurring: mapRecurringRow(updatedRecurringRow),
    total,
  };
}

export async function runDueRecurring(profileId: string, autoOnly = true) {
  const supabase = getSupabaseAdminClient();
  const now = new Date();

  const { data: pocketRows, error: pocketError } = await supabase
    .from("Pocket")
    .select("*")
    .eq("profileId", profileId);

  if (pocketError) {
    throw new Error(`Gagal memuat pocket untuk recurring: ${pocketError.message}`);
  }

  const pocketRecords = (pocketRows ?? []).map((row) => mapPocketRow(row));
  if (pocketRecords.length === 0) {
    return { executed: [], total: 0 };
  }

  const pocketIds = pocketRecords.map((pocket) => pocket.id);

  let query = supabase
    .from("Recurring")
    .select("*")
    .lte("nextRunAt", now.toISOString())
    .in("pocketId", pocketIds);

  if (autoOnly) {
    query = query.eq("autoPost", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Gagal memuat recurring due: ${error.message}`);
  }

  const recurringRows = data ?? [];
  const executed: Array<{
    transactionId: string;
    recurringId: string;
    amount: number;
    type: "income" | "expense";
  }> = [];

  const pocketCache = new Map<string, PocketRecord>(pocketRecords.map((p) => [p.id, p]));

  for (const row of recurringRows) {
    let pocket = pocketCache.get(row.pocketId);
    if (!pocket) {
      pocket = await ensurePocketOwnership(row.pocketId, profileId);
      pocketCache.set(row.pocketId, pocket);
    }

    const schedule = parseSchedule(row.schedule);
    const runAt = new Date();
    const nextRunAt = getNextRun(runAt, schedule);
    const amountAbs = Math.abs(row.amount);
    const delta = row.type === "income" ? amountAbs : -amountAbs;

    const transactionRow = await insertTransactionRow({
      type: row.type,
      amount: amountAbs,
      pocketId: row.pocketId,
      date: runAt.toISOString(),
      note: `[Recurring] ${row.name}`,
      source: "recurring",
      externalRef: `recurring:${row.id}:${runAt.toISOString()}`,
      profileId,
    });

    const updatedPocketRow = await savePocketBalance(pocket.id, pocket.balance + delta);
    const updatedPocket = mapPocketRow(updatedPocketRow);
    pocketCache.set(updatedPocket.id, updatedPocket);

    const { error: updateError } = await supabase
      .from("Recurring")
      .update({
        lastRunAt: runAt.toISOString(),
        nextRunAt: nextRunAt.toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) {
      throw new Error(`Gagal memperbarui recurring ${row.id}: ${updateError.message}`);
    }

    executed.push({
      transactionId: transactionRow.id,
      recurringId: row.id,
      amount: amountAbs,
      type: row.type as "income" | "expense",
    });
  }

  const total = await getTotalBalance(profileId);

  return {
    executed,
    total,
  };
}
