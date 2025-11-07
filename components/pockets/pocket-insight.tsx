"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarRange,
  Loader2,
  NotebookPen,
  Sparkles,
} from "lucide-react";

import {
  getPocketById,
  getPocketCashflowSeries,
  getPocketStats,
  listPocketTransactions,
  updatePocketNote,
} from "@/app/pockets/actions";
import { QuickAddTransactionDialog } from "@/components/transactions/quick-add-transaction-dialog";
import { TransferDialog } from "@/components/transactions/transfer-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUserPref } from "@/components/providers/user-pref-provider";
import type { TxnCreateInput } from "@/lib/validators";
type ComputePocketStatsFn = typeof import("@/lib/repo/pocket-insight").computePocketStats;
type GetPocketCashflowSeriesFn = typeof import("@/lib/repo/pocket-insight").getPocketCashflowSeries;

const PocketChart = dynamic(
  () => import("@/components/analytics/pocket-chart").then((module) => module.PocketChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  },
);

type RangePreset = "7d" | "30d" | "month";
type TypeFilter = "all" | "income" | "expense";

type PocketInfo = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  monthlyBudget: number;
  goalAmount: number;
  balance: number;
  note: string | null;
};

type PocketStatsPayload = Awaited<ReturnType<ComputePocketStatsFn>>;
type PocketCashflowPayload = Awaited<ReturnType<GetPocketCashflowSeriesFn>>;

type RepoListPocketTransactionsFn = typeof import("@/lib/repo/pocket-insight").listPocketTransactions;
type PocketTransactionsPayload = Awaited<ReturnType<RepoListPocketTransactionsFn>>;

type PocketOption = {
  id: string;
  name: string;
  color: string | null;
  balance: number;
};

interface PocketInsightProps {
  pocketId: string;
  pockets: PocketOption[];
  onClose: () => void;
  onOptimisticUpdate?: (payload: { pocketId: string; delta: number }) => void;
  onRefreshRequested?: () => void;
}

type NoteFeedback =
  | {
      type: "error";
      message: string;
    }
  | {
      type: "success";
      message: string;
    }
  | null;

type TransactionItem = PocketTransactionsPayload["items"][number];

type RangeOption = {
  id: RangePreset;
  label: string;
  description: string;
};

const RANGE_OPTIONS: RangeOption[] = [
  { id: "7d", label: "7 Hari", description: "Minggu ini" },
  { id: "30d", label: "30 Hari", description: "30 hari terakhir" },
  { id: "month", label: "Bulan", description: "Bulan berjalan" },
];

const TYPE_OPTIONS: Array<{ id: TypeFilter; label: string }> = [
  { id: "all", label: "Semua" },
  { id: "income", label: "Income" },
  { id: "expense", label: "Expense" },
];

function getDateRange(preset: RangePreset) {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  const from = new Date(now);
  from.setHours(0, 0, 0, 0);

  if (preset === "7d") {
    from.setDate(from.getDate() - 6);
  } else if (preset === "30d") {
    from.setDate(from.getDate() - 29);
  } else if (preset === "month") {
    from.setDate(1);
  }

  return { from, to };
}

function getChartGranularity(preset: RangePreset): "daily" | "weekly" | "monthly" {
  if (preset === "month") return "weekly";
  if (preset === "30d") return "daily";
  return "daily";
}

function ChartSkeleton() {
  return (
    <div className="h-64 w-full animate-pulse rounded-3xl border border-white/40 bg-white/40 dark:border-white/10 dark:bg-white/5" />
  );
}

function HeaderSkeleton() {
  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-white/40 bg-white/80 p-6 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-slate-200/70 dark:bg-slate-700/40" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded-full bg-slate-200/70 dark:bg-slate-700/40" />
          <div className="h-6 w-48 rounded-full bg-slate-200/70 dark:bg-slate-700/40" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-16 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60" />
        <div className="h-16 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60" />
        <div className="h-16 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60" />
      </div>
    </section>
  );
}

function TransactionsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-16 rounded-2xl border border-white/40 bg-white/60 backdrop-blur dark:border-white/10 dark:bg-white/10"
        />
      ))}
    </div>
  );
}

function formatAmountLabel(type: "income" | "expense", amount: number, formatCurrency: (value: number) => string) {
  const formatted = formatCurrency(amount);
  return type === "income" ? `+${formatted}` : `-${formatted}`;
}

export function PocketInsight({ pocketId, pockets, onClose, onOptimisticUpdate, onRefreshRequested }: PocketInsightProps) {
  const { formatCurrency, formatDate } = useUserPref();
  const [rangePreset, setRangePreset] = useState<RangePreset>("30d");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const [pocket, setPocket] = useState<PocketInfo | null>(null);
  const [stats, setStats] = useState<PocketStatsPayload | null>(null);
  const [cashflow, setCashflow] = useState<PocketCashflowPayload | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [loadingPocket, setLoadingPocket] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteFeedback, setNoteFeedback] = useState<NoteFeedback>(null);
  const [quickAction, setQuickAction] = useState<null | "income" | "expense" | "transfer">(null);

  const noteSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const applyLocalBalance = useCallback((delta: number) => {
    setPocket((prev) => (prev ? { ...prev, balance: prev.balance + delta } : prev));
  }, []);

  const currentRange = useMemo(() => getDateRange(rangePreset), [rangePreset]);
  const chartGranularity = useMemo(() => getChartGranularity(rangePreset), [rangePreset]);

  const rangeDays = useMemo(() => {
    const diff = Math.round((currentRange.to.getTime() - currentRange.from.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff + 1);
  }, [currentRange]);

  const adjustStatsOptimistically = useCallback(
    (payload: TxnCreateInput, direction: 1 | -1) => {
      setStats((prev) => {
        if (!prev) return prev;
        if (payload.type === "income") {
          const nextIncome = Math.max(0, prev.totalIncome + payload.amount * direction);
          return { ...prev, totalIncome: nextIncome };
        }

        const nextExpense = Math.max(0, prev.totalExpense + payload.amount * direction);
        const monthlyBudget = pocket?.monthlyBudget ?? 0;
        const overspend = monthlyBudget > 0 && nextExpense > monthlyBudget;
        const overspendPct = monthlyBudget > 0 ? Math.min((nextExpense / monthlyBudget) * 100, 1000) : prev.overspendPct;
        const avgDailyExpense = nextExpense / rangeDays;

        return {
          ...prev,
          totalExpense: nextExpense,
          avgDailyExpense,
          overspend,
          overspendPct,
        };
      });
    },
    [pocket?.monthlyBudget, rangeDays],
  );

  const orderedPockets = useMemo(() => {
    const next = [...pockets];
    const currentIndex = next.findIndex((entry) => entry.id === pocketId);
    if (currentIndex > 0) {
      const [current] = next.splice(currentIndex, 1);
      next.unshift(current);
    }
    return next;
  }, [pocketId, pockets]);

  const handleError = useCallback((message: string) => {
    setErrorMessage(message);
  }, []);

  const resetState = useCallback(() => {
    setStats(null);
    setCashflow(null);
    setTransactions([]);
    setNextCursor(null);
    setErrorMessage(null);
    setLoadingStats(true);
    setLoadingTransactions(true);
  }, []);

  const fetchPocket = useCallback(async () => {
    setLoadingPocket(true);
    const result = await getPocketById(pocketId);
    if (!mountedRef.current) return;
    if (!result.success) {
      handleError(result.error);
      setLoadingPocket(false);
      return;
    }
    const info = result.data;
    setPocket(info);
    setNoteDraft(info.note ?? "");
    setLoadingPocket(false);
  }, [handleError, pocketId]);

  const fetchInsight = useCallback(async () => {
    setLoadingStats(true);
    const [statsResult, cashflowResult] = await Promise.all([
      getPocketStats(pocketId, currentRange),
      getPocketCashflowSeries(pocketId, chartGranularity, currentRange),
    ]);

    if (!mountedRef.current) return;

    if (!statsResult.success) {
      handleError(statsResult.error);
      setLoadingStats(false);
    } else {
      setStats(statsResult.data);
      setLoadingStats(false);
    }

    if (!cashflowResult.success) {
      handleError(cashflowResult.error);
    } else {
      setCashflow(cashflowResult.data);
    }
  }, [chartGranularity, currentRange, handleError, pocketId]);

  const fetchTransactions = useCallback(
    async (cursor?: string, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoadingTransactions(true);
        setErrorMessage(null);
      }

      const result = await listPocketTransactions(pocketId, {
        ...currentRange,
        type: typeFilter === "all" ? undefined : typeFilter,
        cursor,
        limit: 10,
      });

      if (!mountedRef.current) return;

      if (!result.success) {
        handleError(result.error);
      } else {
        setTransactions((previous) =>
          append ? [...previous, ...result.data.items] : [...result.data.items],
        );
        setNextCursor(result.data.nextCursor);
      }

      setLoadingTransactions(false);
      setLoadingMore(false);
    },
    [currentRange, handleError, pocketId, typeFilter],
  );

  const refreshAll = useCallback(async () => {
    resetState();
    await Promise.all([fetchPocket(), fetchInsight(), fetchTransactions()]);
  }, [fetchInsight, fetchPocket, fetchTransactions, resetState]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchPocket();
    return () => {
      mountedRef.current = false;
      if (noteSaveTimeoutRef.current) {
        clearTimeout(noteSaveTimeoutRef.current);
        noteSaveTimeoutRef.current = null;
      }
    };
  }, [fetchPocket]);

  useEffect(() => {
    if (!pocketId) return;
    resetState();
    void fetchInsight();
  }, [fetchInsight, pocketId, resetState]);

  useEffect(() => {
    if (!pocketId) return;
    void fetchTransactions();
  }, [fetchTransactions, pocketId]);

  const handleSaveNote = useCallback(() => {
    if (!pocket) return;
    if (noteSaveTimeoutRef.current) {
      clearTimeout(noteSaveTimeoutRef.current);
      noteSaveTimeoutRef.current = null;
    }
    setNoteSaving(true);
    noteSaveTimeoutRef.current = setTimeout(async () => {
      const result = await updatePocketNote(pocket.id, noteDraft);
      if (!mountedRef.current) return;
      if (!result.success) {
        setNoteFeedback({ type: "error", message: result.error });
      } else {
        setPocket((prev) => (prev ? { ...prev, note: result.data.note ?? null } : prev));
        setNoteFeedback({ type: "success", message: "Catatan tersimpan." });
      }
      setNoteSaving(false);
      noteSaveTimeoutRef.current = null;
    }, 500);
  }, [noteDraft, pocket]);

  useEffect(() => {
    if (!noteFeedback) return;
    const timeout = setTimeout(() => setNoteFeedback(null), 3000);
    return () => clearTimeout(timeout);
  }, [noteFeedback]);

  const hasTransactions = transactions.length > 0;

  const handleQuickAddClosed = useCallback(() => {
    setQuickAction(null);
  }, []);

  const handleTransferClosed = useCallback(() => {
    setQuickAction(null);
  }, []);

  const selectedRangeOption = RANGE_OPTIONS.find((option) => option.id === rangePreset);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 p-4 sm:p-6">
          <header className="flex items-start justify-between gap-3">
            <div>
              <p className="mb-1 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">
                <CalendarRange className="h-4 w-4" />
                {selectedRangeOption?.description ?? ""}
              </p>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Pocket Insight</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">
                Lihat performa pocket dan ambil tindakan cepat.
              </p>
            </div>
            <Button variant="ghost" className="rounded-full" onClick={onClose}>
              Tutup
            </Button>
          </header>

          {loadingPocket ? (
            <HeaderSkeleton />
          ) : pocket ? (
            <section
              className="relative overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-white/80 via-white/60 to-white/80 p-6 shadow-2xl backdrop-blur transition dark:border-white/10 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-slate-900/80"
              style={
                pocket.color
                  ? {
                      boxShadow: `0 20px 60px ${pocket.color}26`,
                    }
                  : undefined
              }
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  background: pocket.color ?? "linear-gradient(135deg, rgba(14,165,233,0.2), rgba(129,140,248,0.2))",
                }}
                aria-hidden
              />
              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-white/60 bg-white/80 text-xl font-semibold text-slate-800 shadow dark:border-white/10 dark:bg-slate-900/80 dark:text-white"
                    style={{
                      color: pocket.color ?? undefined,
                      borderColor: pocket.color ? `${pocket.color}66` : undefined,
                    }}
                  >
                    {pocket.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{pocket.name}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Saldo saat ini</p>
                    <p className="text-2xl font-semibold text-slate-900 tabular-nums dark:text-white">
                      {formatCurrency(pocket.balance)}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:text-right">
                  {pocket.monthlyBudget > 0 ? (
                    <div className="inline-flex items-center justify-between gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-4 py-1 text-xs font-semibold text-cyan-600 dark:border-cyan-500/30 dark:bg-cyan-500/15 dark:text-cyan-200 sm:justify-end">
                      <Sparkles className="h-4 w-4" />
                      Anggaran: {formatCurrency(pocket.monthlyBudget)}
                    </div>
                  ) : null}
                  {pocket.goalAmount > 0 ? (
                    <div className="inline-flex items-center justify-between gap-2 rounded-full border border-violet-400/40 bg-violet-500/10 px-4 py-1 text-xs font-semibold text-violet-600 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-200 sm:justify-end">
                      Target: {formatCurrency(pocket.goalAmount)}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <article className="flex flex-col gap-4 rounded-3xl border border-white/40 bg-white/80 p-6 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Cashflow Pocket</h3>
                <div className="flex gap-2 rounded-full border border-white/40 bg-white/60 p-1 text-xs dark:border-white/10 dark:bg-slate-900/60">
                  {RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setRangePreset(option.id)}
                      className={cn(
                        "rounded-full px-3 py-1 font-medium transition",
                        rangePreset === option.id
                          ? "bg-cyan-500/90 text-white shadow-sm"
                          : "text-slate-600 hover:bg-cyan-500/10 dark:text-slate-300",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              {loadingStats || !cashflow ? (
                <ChartSkeleton />
              ) : (
                <PocketChart data={cashflow} formatCurrency={formatCurrency} formatDate={formatDate} />
              )}
            </article>

            <article className="flex flex-col gap-4 rounded-3xl border border-white/40 bg-white/80 p-6 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Statistik Ringkas</h3>
              {loadingStats || !stats ? (
                <div className="grid gap-3">
                  <div className="h-20 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60" />
                  <div className="h-20 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60" />
                  <div className="h-20 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60" />
                  <div className="h-20 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60" />
                </div>
              ) : (
                <dl className="grid gap-3">
                  <StatCard
                    title="Total Income"
                    value={formatCurrency(stats.totalIncome)}
                    subtitle="Periode terpilih"
                    tone="positive"
                    icon={<ArrowDownCircle className="h-5 w-5" />}
                  />
                  <StatCard
                    title="Total Expense"
                    value={formatCurrency(stats.totalExpense)}
                    subtitle={
                      stats.topExpense
                        ? `Terbesar: ${formatCurrency(stats.topExpense.amount)} • ${formatDate(stats.topExpense.date)}`
                        : "Tidak ada pengeluaran besar"
                    }
                    tone="negative"
                    icon={<ArrowUpCircle className="h-5 w-5" />}
                  />
                  <StatCard
                    title="Rata-rata harian"
                    value={formatCurrency(Math.round(stats.avgDailyExpense))}
                    subtitle="Pengeluaran / hari"
                    tone="neutral"
                    icon={<NotebookPen className="h-5 w-5" />}
                  />
                  <StatCard
                    title="Overspend"
                    value={
                      stats.overspend
                        ? `${stats.overspendPct.toFixed(0)}%`
                        : pocket?.monthlyBudget
                          ? "On track"
                          : "Tanpa anggaran"
                    }
                    subtitle={
                      pocket?.monthlyBudget
                        ? stats.overspend
                          ? `Melebihi anggaran ${formatCurrency(stats.totalExpense - (pocket.monthlyBudget ?? 0))}`
                          : "Masih aman"
                        : "Belum ada anggaran ditetapkan"
                    }
                    tone={stats.overspend ? "warning" : "positive"}
                    icon={<AlertTriangle className="h-5 w-5" />}
                  />
                </dl>
              )}
            </article>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <article className="flex flex-col gap-4 rounded-3xl border border-white/40 bg-white/80 p-6 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Transaksi Terbaru</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-300">Filter waktu dan tipe sesuai kebutuhan.</p>
                </div>
                <div className="flex gap-2 rounded-full border border-white/40 bg-white/60 p-1 text-xs dark:border-white/10 dark:bg-slate-900/60">
                  {TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTypeFilter(option.id)}
                      className={cn(
                        "rounded-full px-3 py-1 font-medium transition",
                        typeFilter === option.id
                          ? "bg-slate-900 text-white dark:bg-white/90 dark:text-slate-900"
                          : "text-slate-600 hover:bg-cyan-500/10 dark:text-slate-300",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </header>

              {loadingTransactions ? (
                <TransactionsSkeleton />
              ) : hasTransactions ? (
                <div className="space-y-3">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="group relative flex items-center justify-between rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-400/60 hover:shadow-lg dark:border-white/10 dark:bg-slate-900/70"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white shadow-inner",
                            transaction.type === "income" ? "bg-emerald-500/90" : "bg-rose-500/90",
                          )}
                        >
                          {transaction.type === "income" ? <ArrowDownCircle className="h-5 w-5" /> : <ArrowUpCircle className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {transaction.note ?? (transaction.type === "income" ? "Income" : "Expense")}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-300">{formatDate(transaction.date)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            transaction.type === "income" ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300",
                          )}
                        >
                          {formatAmountLabel(transaction.type as "income" | "expense", transaction.amount, formatCurrency)}
                        </p>
                        {transaction.source === "transfer" ? (
                          <p className="text-xs text-slate-400 dark:text-slate-400">Transfer</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {nextCursor ? (
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full px-4 py-2"
                        disabled={loadingMore}
                        onClick={() => fetchTransactions(nextCursor, true)}
                      >
                        {loadingMore ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Memuat...
                          </>
                        ) : (
                          "Muat lagi"
                        )}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300/80 bg-white/40 p-8 text-center dark:border-slate-700 dark:bg-slate-900/30">
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    Belum ada transaksi pada rentang ini.
                  </p>
                  <Button
                    type="button"
                    className="rounded-full"
                    onClick={() => setQuickAction("expense")}
                  >
                    Tambah transaksi pertama
                  </Button>
                </div>
              )}
            </article>

            <div className="flex flex-col gap-6">
              <article className="flex flex-col gap-3 rounded-3xl border border-white/40 bg-white/80 p-6 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
                <header className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Catatan Pocket</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-300">Simpan insight personal terkait pocket ini.</p>
                  </div>
                </header>
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  rows={6}
                  className="min-h-[160px] resize-none rounded-3xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-700 shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="Tulis catatan personal, misal rencana pengeluaran atau pengingat."
                />
                <div className="flex items-center justify-between">
                  {noteFeedback ? (
                    <p
                      className={cn(
                        "text-xs font-semibold",
                        noteFeedback.type === "error"
                          ? "text-rose-500"
                          : "text-emerald-500",
                      )}
                    >
                      {noteFeedback.message}
                    </p>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500">Disimpan secara manual.</span>
                  )}
                  <Button
                    type="button"
                    className="rounded-full"
                    onClick={handleSaveNote}
                    disabled={noteSaving}
                  >
                    {noteSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Simpan
                  </Button>
                </div>
              </article>

              <article className="flex flex-col gap-4 rounded-3xl border border-white/40 bg-white/80 p-6 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
                <header>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Quick Actions</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-300">Tambah income/expense atau transfer antar pocket.</p>
                </header>
                <div className="grid gap-3">
                  <Button
                    type="button"
                    className="h-12 rounded-full bg-emerald-500/90 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-500"
                    onClick={() => setQuickAction("income")}
                  >
                    + Income
                  </Button>
                  <Button
                    type="button"
                    className="h-12 rounded-full bg-rose-500/90 text-sm font-semibold text-white shadow-md transition hover:bg-rose-500"
                    onClick={() => setQuickAction("expense")}
                  >
                    + Expense
                  </Button>
                  <Button
                    type="button"
                    className="h-12 rounded-full bg-gradient-to-r from-violet-500/90 to-sky-500/90 text-sm font-semibold text-white shadow-md transition hover:from-violet-500 hover:to-sky-500"
                    onClick={() => setQuickAction("transfer")}
                    disabled={orderedPockets.length < 2}
                  >
                    Transfer
                  </Button>
                </div>
              </article>
            </div>
          </section>

          {errorMessage ? (
            <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </div>

      <QuickAddTransactionDialog
        pockets={orderedPockets}
        hideTrigger
        autoOpen={quickAction === "income"}
        defaultType="income"
        defaultPocketId={pocketId}
        onOpenChange={(open) => {
          if (!open) handleQuickAddClosed();
        }}
        onOptimisticCreate={(payload: TxnCreateInput) => {
          const delta = payload.type === "income" ? payload.amount : -payload.amount;
          applyLocalBalance(delta);
          adjustStatsOptimistically(payload, 1);
          onOptimisticUpdate?.({ pocketId: payload.pocketId, delta });
        }}
        onSettled={(result, payload) => {
          const delta = payload.type === "income" ? payload.amount : -payload.amount;
          if (!result.success) {
            applyLocalBalance(-delta);
            adjustStatsOptimistically(payload, -1);
            onOptimisticUpdate?.({ pocketId: payload.pocketId, delta: -delta });
            return;
          }
          onRefreshRequested?.();
          void refreshAll();
        }}
      />

      <QuickAddTransactionDialog
        pockets={orderedPockets}
        hideTrigger
        autoOpen={quickAction === "expense"}
        defaultType="expense"
        defaultPocketId={pocketId}
        onOpenChange={(open) => {
          if (!open) handleQuickAddClosed();
        }}
        onOptimisticCreate={(payload: TxnCreateInput) => {
          const delta = payload.type === "income" ? payload.amount : -payload.amount;
          applyLocalBalance(delta);
          adjustStatsOptimistically(payload, 1);
          onOptimisticUpdate?.({ pocketId: payload.pocketId, delta });
        }}
        onSettled={(result, payload) => {
          const delta = payload.type === "income" ? payload.amount : -payload.amount;
          if (!result.success) {
            applyLocalBalance(-delta);
            adjustStatsOptimistically(payload, -1);
            onOptimisticUpdate?.({ pocketId: payload.pocketId, delta: -delta });
            return;
          }
          onRefreshRequested?.();
          void refreshAll();
        }}
      />

      <TransferDialog
        pockets={orderedPockets}
        autoOpen={quickAction === "transfer"}
        defaultFromId={pocketId}
        onOpenChange={(open) => {
          if (!open) handleTransferClosed();
        }}
        onOptimisticTransfer={(input) => {
          if (input.fromId === pocketId) {
            applyLocalBalance(-input.amount);
          }
          if (input.toId === pocketId) {
            applyLocalBalance(input.amount);
          }
          onOptimisticUpdate?.({ pocketId: input.fromId, delta: -input.amount });
          onOptimisticUpdate?.({ pocketId: input.toId, delta: input.amount });
        }}
        onSettled={(result, context) => {
          if (!result.success) {
            if (context.fromId === pocketId) {
              applyLocalBalance(context.amount);
            }
            if (context.toId === pocketId) {
              applyLocalBalance(-context.amount);
            }
            onOptimisticUpdate?.({ pocketId: context.fromId, delta: context.amount });
            onOptimisticUpdate?.({ pocketId: context.toId, delta: -context.amount });
            return;
          }
          onRefreshRequested?.();
          void refreshAll();
        }}
      />
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  tone: "positive" | "negative" | "neutral" | "warning";
  icon: ReactNode;
}

function StatCard({ title, value, subtitle, tone, icon }: StatCardProps) {
  const toneClasses: Record<StatCardProps["tone"], string> = {
    positive: "border-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    negative: "border-rose-400/50 bg-rose-500/10 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
    neutral: "border-slate-200/80 bg-white/80 text-slate-700 dark:border-slate-600/60 dark:bg-slate-900/70 dark:text-slate-200",
    warning: "border-amber-400/60 bg-amber-500/10 text-amber-600 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200",
  };

  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border px-4 py-3 backdrop-blur", toneClasses[tone])}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-inner dark:bg-white/10 dark:text-white">
        {icon}
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">{title}</dt>
        <dd className="text-lg font-semibold text-slate-900 dark:text-white">{value}</dd>
        <p className="text-xs text-slate-500 dark:text-slate-300">{subtitle}</p>
      </div>
    </div>
  );
}

export default PocketInsight;
