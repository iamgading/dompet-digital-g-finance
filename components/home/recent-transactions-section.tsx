import { listTransactions } from "@/app/actions/finance";
import type { TransactionHistoryItem } from "@/components/transactions/transaction-history-list";
import { InteractiveTransactionHistory } from "@/components/transactions/interactive-transaction-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { translate } from "@/lib/i18n";

interface RecentTransactionsSectionProps {
  locale: string;
}

export async function RecentTransactionsSection({ locale }: RecentTransactionsSectionProps) {
  const result = await listTransactions({ limit: 8, order: "desc" });
  if (!result.success) {
    return (
      <Card className="rounded-3xl border border-white/40 bg-white/70 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {translate(locale, "transactions.sectionTitle", "Riwayat Transaksi")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-sm text-rose-500">
          {translate(locale, "transactions.error", "Gagal memuat transaksi terbaru.")}
        </CardContent>
      </Card>
    );
  }

  const transactions: TransactionHistoryItem[] = result.data.map((transaction) => ({
    id: transaction.id,
    type: transaction.type as "income" | "expense",
    amount: transaction.amount,
    note: transaction.note,
    date: transaction.date instanceof Date ? transaction.date.toISOString() : transaction.date,
    pocket: transaction.pocket
      ? {
          id: transaction.pocket.id,
          name: transaction.pocket.name,
          color: transaction.pocket.color,
        }
      : null,
  }));

  return (
    <Card className="rounded-3xl border border-white/40 bg-white/70 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/10">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {translate(locale, "transactions.sectionTitle", "Riwayat Transaksi")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <InteractiveTransactionHistory
          initialTransactions={transactions}
          showPocketName
          emptyMessage={translate(locale, "transactions.empty", "Belum ada transaksi tercatat.")}
        />
      </CardContent>
    </Card>
  );
}

export function RecentTransactionsFallback({ locale }: { locale: string }) {
  return (
    <Card className="rounded-3xl border border-white/30 bg-white/60 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/5">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {translate(locale, "transactions.sectionTitle", "Riwayat Transaksi")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 text-sm text-slate-500 dark:text-slate-300">
        {translate(locale, "transactions.loading", "Memuat transaksi terbaru...")}
      </CardContent>
    </Card>
  );
}
