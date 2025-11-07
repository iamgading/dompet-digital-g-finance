"use client";

import { Trash2 } from "lucide-react";

import { useUserPref } from "@/components/providers/user-pref-provider";
import { cn } from "@/lib/utils";

export type TransactionHistoryItem = {
  id: string;
  type: "income" | "expense";
  amount: number;
  note: string | null;
  date: string;
  pocket?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
};

interface TransactionHistoryListProps {
  transactions: TransactionHistoryItem[];
  emptyMessage?: string;
  showPocketName?: boolean;
  className?: string;
  onDelete?: (transaction: TransactionHistoryItem) => void;
  deletingIds?: readonly string[];
  onPocketSelect?: (pocketId: string) => void;
}

export function TransactionHistoryList({
  transactions,
  emptyMessage = "Belum ada transaksi.",
  showPocketName = false,
  className,
  onDelete,
  deletingIds,
  onPocketSelect,
}: TransactionHistoryListProps) {
  const { formatCurrency, formatDate } = useUserPref();

  if (transactions.length === 0) {
    return (
      <div className={cn("flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/40 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("divide-y divide-slate-200 overflow-hidden rounded-2xl border border-white/40 bg-white/70 shadow-sm backdrop-blur dark:divide-white/10 dark:border-white/10 dark:bg-white/10", className)}>
      {transactions.map((transaction) => {
        const isIncome = transaction.type === "income";
        const formattedAmount = formatCurrency(transaction.amount);
        const amountLabel = `${isIncome ? "+" : "-"} ${formattedAmount}`;
        const dateLabel = formatDate(transaction.date, { dateStyle: "medium" });

        return (
          <div key={transaction.id} className="flex flex-col gap-3 p-4 text-sm text-slate-700 dark:text-slate-200 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold",
                    isIncome
                      ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                      : "bg-rose-500/10 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
                  )}
                >
                  {isIncome ? "Pemasukan" : "Pengeluaran"}
                </span>
                {showPocketName && transaction.pocket ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (onPocketSelect) {
                        onPocketSelect(transaction.pocket!.id);
                        return;
                      }
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("open-pocket-insight", { detail: { pocketId: transaction.pocket!.id } }),
                        );
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-slate-500 transition hover:bg-cyan-500/10 hover:text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-slate-300 dark:hover:text-cyan-300"
                    aria-label={`Lihat insight pocket ${transaction.pocket.name}`}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: transaction.pocket.color ?? "#0ea5e9" }}
                    />
                    {transaction.pocket.name}
                  </button>
                ) : null}
              </div>
              <p className="mt-2 font-medium text-slate-800 dark:text-slate-100">
                {transaction.note ?? "(tanpa catatan)"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-300">{dateLabel}</p>
            </div>
            <div className="flex items-center gap-3 md:flex-col md:items-end">
              <span
                className={cn(
                  "text-base font-semibold",
                  isIncome ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300",
                )}
              >
                {amountLabel}
              </span>
              {onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(transaction)}
                  disabled={Boolean(deletingIds?.includes(transaction.id))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-slate-400 transition hover:-translate-y-0.5 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-50 dark:text-slate-500 dark:hover:text-rose-300"
                  aria-label="Hapus transaksi"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
