import dynamic from "next/dynamic";
import { Suspense } from "react";

import { getCashflowSummary, type CashflowRangePreset } from "@/app/actions/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CashflowRangePicker } from "@/components/home/cashflow-range-picker";
import { translate } from "@/lib/i18n";

function getRangeOptions(locale: string): Array<{ id: CashflowRangePreset; label: string }> {
  if (locale.startsWith("en")) {
    return [
      { id: "30d", label: "30 Days" },
      { id: "90d", label: "90 Days" },
      { id: "180d", label: "6 Months" },
      { id: "ytd", label: "YTD" },
    ];
  }
  return [
    { id: "30d", label: "30 Hari" },
    { id: "90d", label: "90 Hari" },
    { id: "180d", label: "6 Bulan" },
    { id: "ytd", label: "YTD" },
  ];
}

interface CashflowSectionProps {
  range?: CashflowRangePreset;
  locale: string;
}

const CashflowChart = dynamic(() => import("@/components/analytics/cashflow-chart").then((mod) => mod.CashflowChart), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-300">
      Memuat grafik arus kas...
    </div>
  ),
});

const DEFAULT_CASHFLOW_RANGE: CashflowRangePreset = "30d";

export async function CashflowSection({ range, locale }: CashflowSectionProps) {
  const selectedRange = range ?? DEFAULT_CASHFLOW_RANGE;
  const result = await getCashflowSummary({ range: selectedRange });
  if (!result.success) {
    return (
      <Card className="rounded-3xl border border-white/40 bg-white/70 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/10">
        <CardContent className="p-6 text-sm text-rose-500">
          {translate(locale, "cashflow.error", "Gagal memuat data cashflow.")}
        </CardContent>
      </Card>
    );
  }

  const options = getRangeOptions(locale);
  return (
    <Card className="flex h-full flex-col rounded-3xl border border-white/40 bg-white/70 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/10">
      <CardHeader className="flex flex-col gap-4 pb-2 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {translate(locale, "cashflow.title", "Arus Kas")}
          </CardTitle>
          <p className="text-xs text-slate-500 dark:text-slate-300">
            {translate(
              locale,
              "cashflow.subtitle",
              "Pemasukan, pengeluaran, dan saldo kumulatif pada rentang pilihan Anda.",
            )}
          </p>
        </div>
        <CashflowRangePicker
          options={options}
          currentRange={selectedRange}
          defaultRange={DEFAULT_CASHFLOW_RANGE}
        />
      </CardHeader>
      <CardContent className="flex-1 p-6 pt-0">
        <CashflowChart data={result.data} />
      </CardContent>
    </Card>
  );
}

export function CashflowFallback({ locale }: { locale: string }) {
  return (
    <Card className="rounded-3xl border border-white/30 bg-white/60 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/5">
      <CardContent className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-300">
        {translate(locale, "cashflow.loading", "Memuat grafik arus kas...")}
      </CardContent>
    </Card>
  );
}
