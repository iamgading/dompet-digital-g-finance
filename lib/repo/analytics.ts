import { getSupabaseAdminClient } from "@/lib/supabase";
import { mapPocketRow } from "@/lib/repo/pockets";

type CashflowRow = { income: number; expense: number; balance: number };

export async function getCashflowSummaryByRange(profileId: string, from: Date, to: Date) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("Transaction")
    .select("*")
    .eq("profileId", profileId)
    .gte("date", from.toISOString())
    .lt("date", to.toISOString())
    .order("date", { ascending: true })
    .or("source.is.null,source.neq.transfer");

  if (error) {
    throw new Error(`Gagal memuat ringkasan cashflow: ${error.message}`);
  }

  let cumulative = 0;
  const byDay = new Map<string, CashflowRow>();

  for (const txn of data ?? []) {
    const key = new Date(txn.date).toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { income: 0, expense: 0, balance: 0 };
    if (txn.type === "income") {
      entry.income += txn.amount;
      cumulative += txn.amount;
    } else if (txn.type === "expense") {
      entry.expense += txn.amount;
      cumulative -= txn.amount;
    }
    entry.balance = cumulative;
    byDay.set(key, entry);
  }

  return Array.from(byDay.entries())
    .map(([date, value]) => ({
      date,
      income: value.income,
      expense: value.expense,
      balance: value.balance,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getCashflowSummaryByMonth(month: Date, profileId: string) {
  const start = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const end = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
  return getCashflowSummaryByRange(profileId, start, end);
}

export async function getPocketSummaries(profileId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("Pocket")
    .select("*")
    .eq("profileId", profileId)
    .eq("isActive", true);

  if (error) {
    throw new Error(`Gagal memuat ringkasan pocket: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const pocket = mapPocketRow(row);
    return {
      id: pocket.id,
      name: pocket.name,
      balance: pocket.balance,
      monthlyBudget: pocket.monthlyBudget,
      isActive: pocket.isActive,
    };
  });
}
