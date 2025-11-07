import { addMonths, startOfMonth } from "date-fns";

import { getSupabaseAdminClient } from "@/lib/supabase";
import type { CashflowCalendarEntry } from "@/types/calendar";

const BIG_EXPENSE_THRESHOLD = 1_000_000; // 1M IDR

type CalendarOptions = {
  month?: Date;
};

export async function getCashflowCalendarEntries(profileId: string, options?: CalendarOptions) {
  const targetMonth = options?.month && !Number.isNaN(options.month.getTime()) ? options.month : new Date();
  const start = startOfMonth(targetMonth);
  const end = addMonths(start, 1);

  const supabase = getSupabaseAdminClient();

  const [transactionsRes, recurringRes] = await Promise.all([
    supabase
      .from("Transaction")
      .select("id,type,amount,date,source")
      .eq("profileId", profileId)
      .gte("date", start.toISOString())
      .lt("date", end.toISOString())
      .order("date", { ascending: true }),
    supabase
      .from("Recurring")
      .select("id,name,type,amount,nextRunAt,Pocket!inner(profileId)")
      .eq("Pocket.profileId", profileId)
      .gte("nextRunAt", start.toISOString())
      .lt("nextRunAt", end.toISOString()),
  ]);

  if (transactionsRes.error) {
    throw new Error(`Gagal memuat transaksi kalender: ${transactionsRes.error.message}`);
  }

  if (recurringRes.error) {
    throw new Error(`Gagal memuat jadwal recurring: ${recurringRes.error.message}`);
  }

  const entryMap = new Map<string, CashflowCalendarEntry>();

  const upsertEntry = (dateKey: string): CashflowCalendarEntry => {
    const existing = entryMap.get(dateKey);
    if (existing) return existing;
    const fresh: CashflowCalendarEntry = {
      date: dateKey,
      income: 0,
      expense: 0,
      type: "net",
    };
    entryMap.set(dateKey, fresh);
    return fresh;
  };

  for (const txn of transactionsRes.data ?? []) {
    const key = txn.date.slice(0, 10);
    const entry = upsertEntry(key);
    if (txn.type === "income") {
      entry.income += txn.amount;
    } else if (txn.type === "expense") {
      entry.expense += txn.amount;
      if (txn.amount >= BIG_EXPENSE_THRESHOLD) {
        entry.type = "big-expense";
        entry.label = "Pengeluaran besar";
      }
    }
    if (!entry.label && txn.source === "transfer") {
      entry.label = "Transfer";
    }
  }

  const paydayHints: Array<{ date: string; label: string }> = [];

  for (const recurring of recurringRes.data ?? []) {
    if (!recurring.nextRunAt) continue;
    const key = recurring.nextRunAt.slice(0, 10);
    const entry = upsertEntry(key);
    entry.type = "recurring";
    entry.label = recurring.name;
    if (recurring.type === "income") {
      entry.income += recurring.amount;
      paydayHints.push({ date: key, label: recurring.name });
    } else {
      entry.expense += recurring.amount;
    }
  }

  const sorted = Array.from(entryMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  let cumulative = 0;
  for (const entry of sorted) {
    const net = entry.income - entry.expense;
    if (net > 0) {
      entry.direction = "up";
      entry.delta = net;
    } else if (net < 0) {
      entry.direction = "down";
      entry.delta = Math.abs(net);
      if (entry.expense > entry.income * 1.5) {
        entry.alert = "Pengeluaran melebihi pemasukan";
      }
    } else {
      entry.direction = "flat";
      entry.delta = 0;
    }
    cumulative += net;
  }

  return {
    entries: sorted,
    paydayHints,
  };
}
