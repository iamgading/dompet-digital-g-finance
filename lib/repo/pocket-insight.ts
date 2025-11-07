import { getSupabaseAdminClient } from "@/lib/supabase";
import { mapPocketRow } from "@/lib/repo/pockets";
import { mapTransactionRow, type TransactionRecord } from "@/lib/repo/transactions";

export type DateRange = {
  from: Date;
  to: Date;
};

export async function findPocketById(pocketId: string, profileId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("Pocket")
    .select("id,name,icon,color,monthlyBudget,goalAmount,balance,note")
    .eq("id", pocketId)
    .eq("profileId", profileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal memuat pocket: ${error.message}`);
  }

  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    icon: data.icon,
    color: data.color,
    monthlyBudget: data.monthlyBudget,
    goalAmount: data.goalAmount,
    balance: data.balance,
    note: data.note,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function diffDayInclusive(range: DateRange) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const start = new Date(range.from);
  const end = new Date(range.to);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = Math.round((end.getTime() - start.getTime()) / msPerDay);
  return clamp(diff + 1, 1, 366 * 5);
}

export async function computePocketStats(pocketId: string, range: DateRange, profileId: string) {
  const supabase = getSupabaseAdminClient();
  const fromISO = range.from.toISOString();
  const toISO = range.to.toISOString();

  const { data, error } = await supabase
    .from("Transaction")
    .select("amount,type,date,note")
    .eq("pocketId", pocketId)
    .eq("profileId", profileId)
    .gte("date", fromISO)
    .lte("date", toISO)
    .or("source.is.null,source.neq.transfer");

  if (error) {
    throw new Error(`Gagal menghitung statistik pocket: ${error.message}`);
  }

  const transactions = data ?? [];
  const totalIncome = transactions
    .filter((txn) => txn.type === "income")
    .reduce((sum, txn) => sum + txn.amount, 0);
  const totalExpense = transactions
    .filter((txn) => txn.type === "expense")
    .reduce((sum, txn) => sum + txn.amount, 0);
  const days = diffDayInclusive(range);
  const avgDailyExpense = totalExpense / days;

  const topExpense = transactions
    .filter((txn) => txn.type === "expense")
    .sort((a, b) => {
      if (b.amount !== a.amount) {
        return b.amount - a.amount;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    })[0];

  const { data: pocketRow, error: pocketError } = await supabase
    .from("Pocket")
    .select("monthlyBudget")
    .eq("id", pocketId)
    .eq("profileId", profileId)
    .maybeSingle();

  if (pocketError) {
    throw new Error(`Gagal memuat data pocket: ${pocketError.message}`);
  }

  const monthlyBudget = pocketRow?.monthlyBudget ?? 0;
  const overspend = monthlyBudget > 0 && totalExpense > monthlyBudget;
  const overspendPct =
    monthlyBudget > 0 ? clamp((totalExpense / monthlyBudget) * 100, 0, 1000) : 0;

  return {
    totalIncome,
    totalExpense,
    avgDailyExpense,
    topExpense: topExpense
      ? {
          date: new Date(topExpense.date),
          amount: topExpense.amount,
          note: topExpense.note ?? undefined,
        }
      : null,
    overspend,
    overspendPct,
  };
}

export type CashflowGranularity = "daily" | "weekly" | "monthly";

type CashflowBucket = {
  income: number;
  expense: number;
};

function getBucketKey(date: Date, granularity: CashflowGranularity) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  if (granularity === "weekly") {
    const day = d.getDay();
    const diff = (day + 6) % 7;
    d.setDate(d.getDate() - diff);
  }

  if (granularity === "monthly") {
    d.setDate(1);
  }

  return d.toISOString().slice(0, 10);
}

export async function getPocketCashflowSeries(
  pocketId: string,
  granularity: CashflowGranularity,
  range: DateRange,
  profileId: string,
) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("Transaction")
    .select("amount,type,date")
    .eq("pocketId", pocketId)
    .eq("profileId", profileId)
    .gte("date", range.from.toISOString())
    .lte("date", range.to.toISOString())
    .or("source.is.null,source.neq.transfer")
    .order("date", { ascending: true });

  if (error) {
    throw new Error(`Gagal memuat cashflow pocket: ${error.message}`);
  }

  const buckets = new Map<string, CashflowBucket>();

  for (const txn of data ?? []) {
    const key = getBucketKey(new Date(txn.date), granularity);
    const current = buckets.get(key) ?? { income: 0, expense: 0 };
    if (txn.type === "income") {
      current.income += txn.amount;
    } else if (txn.type === "expense") {
      current.expense += txn.amount;
    }
    buckets.set(key, current);
  }

  return Array.from(buckets.entries())
    .map(([date, entry]) => ({
      date,
      income: entry.income,
      expense: entry.expense,
      balanceAfter: null as number | null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type TransactionFilter = {
  from?: Date;
  to?: Date;
  type?: "income" | "expense";
  limit?: number;
  cursor?: string;
};

export async function listPocketTransactions(
  pocketId: string,
  filter: TransactionFilter = {},
  profileId: string,
) {
  const take = clamp(filter.limit ?? 10, 1, 50);
  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from("Transaction")
    .select("*")
    .eq("pocketId", pocketId)
    .eq("profileId", profileId)
    .order("date", { ascending: false })
    .order("createdAt", { ascending: false });

  if (filter.type) {
    query = query.eq("type", filter.type);
  }

  if (filter.from) {
    query = query.gte("date", filter.from.toISOString());
  }

  if (filter.to) {
    query = query.lte("date", filter.to.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Gagal memuat transaksi pocket: ${error.message}`);
  }

  const mapped = (data ?? []).map((row) => mapTransactionRow(row));

  let startIndex = 0;
  if (filter.cursor) {
    const cursorIndex = mapped.findIndex((txn) => txn.id === filter.cursor);
    if (cursorIndex >= 0) {
      startIndex = cursorIndex + 1;
    }
  }

  const items = mapped.slice(startIndex, startIndex + take);
  const nextCursor = mapped.length > startIndex + take ? mapped[startIndex + take].id : null;

  return {
    items,
    nextCursor,
  };
}

export async function savePocketNote(pocketId: string, note: string, profileId: string) {
  const supabase = getSupabaseAdminClient();

  const { data: existing, error: lookupError } = await supabase
    .from("Pocket")
    .select("id")
    .eq("id", pocketId)
    .eq("profileId", profileId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Gagal memuat pocket: ${lookupError.message}`);
  }

  if (!existing) {
    throw new Error("Pocket tidak ditemukan pada profil aktif.");
  }

  const trimmed = note.trim();
  const { data, error } = await supabase
    .from("Pocket")
    .update({
      note: trimmed.length > 0 ? trimmed : null,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", pocketId)
    .select("id,note")
    .single();

  if (error) {
    throw new Error(`Gagal menyimpan catatan pocket: ${error.message}`);
  }

  return data;
}
