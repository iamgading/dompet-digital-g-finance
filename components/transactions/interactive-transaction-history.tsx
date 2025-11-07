"use client";

import { useMemo, useState, useTransition } from "react";

import { deleteTransaction } from "@/app/actions/finance";
import type { TransactionHistoryItem } from "@/components/transactions/transaction-history-list";
import { TransactionHistoryList } from "@/components/transactions/transaction-history-list";

interface InteractiveTransactionHistoryProps {
  initialTransactions: TransactionHistoryItem[];
  showPocketName?: boolean;
  emptyMessage?: string;
  onPocketSelect?: (pocketId: string) => void;
}

export function InteractiveTransactionHistory({
  initialTransactions,
  showPocketName,
  emptyMessage,
  onPocketSelect,
}: InteractiveTransactionHistoryProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const deletingIds = useMemo(() => (pendingId ? [pendingId] : undefined), [pendingId]);

  const handleDelete = (transaction: TransactionHistoryItem) => {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      setPendingId(transaction.id);
      const result = await deleteTransaction(transaction.id);
      if (!result.success) {
        setError(result.error ?? "Gagal menghapus transaksi.");
        setPendingId(null);
        return;
      }
      setTransactions((current) => current.filter((item) => item.id !== transaction.id));
      setPendingId(null);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <TransactionHistoryList
        transactions={transactions}
        showPocketName={showPocketName}
        emptyMessage={emptyMessage}
        onDelete={handleDelete}
        deletingIds={deletingIds}
        onPocketSelect={onPocketSelect}
      />
      {error ? <p className="text-sm text-rose-500 dark:text-rose-300">{error}</p> : null}
    </div>
  );
}
