import { AlertTriangle, PiggyBank } from "lucide-react";

import { getInsights } from "@/app/actions/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { translate } from "@/lib/i18n";

const ICONS = {
  overspend: AlertTriangle,
  saving: PiggyBank,
} as const;

const COLORS = {
  overspend: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200",
  saving: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
} as const;

interface InsightSectionProps {
  locale: string;
}

export async function InsightSection({ locale }: InsightSectionProps) {
  const result = await getInsights();
  if (!result.success) {
    return (
      <Card className="rounded-3xl border border-white/40 bg-white/70 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/10">
        <CardContent className="p-6 text-sm text-rose-500">Gagal memuat insight.</CardContent>
      </Card>
    );
  }

  const insights = result.data;

  return (
    <Card className="flex h-full flex-col rounded-3xl border border-white/40 bg-white/70 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {translate(locale, "insight.title", "Insight Hari Ini")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {insights.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            {translate(locale, "insight.empty", "Belum ada insight khusus hari ini. Pertahankan kebiasaan baik!")}
          </p>
        ) : (
          insights.map((insight, index) => {
            const Icon = ICONS[insight.type];
            return (
              <div
                key={`${insight.type}-${index}`}
                className="flex items-start gap-3 rounded-2xl border border-white/40 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${COLORS[insight.type]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-200">{insight.message}</p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export function InsightFallback({ locale }: { locale: string }) {
  return (
    <Card className="rounded-3xl border border-white/30 bg-white/60 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/5">
      <CardContent className="p-6 text-sm text-slate-500 dark:text-slate-300">
        {translate(locale, "insight.loading", "Menyiapkan insight...")}
      </CardContent>
    </Card>
  );
}
