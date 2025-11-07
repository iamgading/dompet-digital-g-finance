import { Suspense } from "react";

import { getCashflowCalendar } from "@/app/actions/calendar";
import { getCachedUserPref } from "@/app/actions/user-pref";
import { CashflowCalendar } from "@/components/calendar";
import { BackToDashboardButton } from "@/components/shared/back-to-dashboard";
import { translate } from "@/lib/i18n";

async function CalendarContent({ locale }: { locale: string }) {
  const result = await getCashflowCalendar();
  if (!result.success || result.data.entries.length === 0) {
    return (
      <div className="rounded-3xl border border-white/20 bg-white/70 p-6 text-sm text-slate-600 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-300">
        {translate(locale, "calendar.empty", "Belum ada data untuk ditampilkan. Tambahkan transaksi atau jadwalkan recurring untuk melihat kalender cashflow.")}
      </div>
    );
  }
  return <CashflowCalendar entries={result.data.entries} paydayHints={result.data.paydayHints} />;
}

export default async function CalendarPage() {
  const pref = await getCachedUserPref();
  const locale = pref.locale;
  return (
    <main className="relative min-h-screen bg-gradient-to-br from-sky-100 via-white to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-50 blur-3xl">
        <div className="mx-auto h-64 w-64 rounded-full bg-cyan-400/30 dark:bg-cyan-500/20" />
      </div>
      <div className="mx-auto w-full max-w-5xl px-6 py-16">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-cyan-600 dark:text-cyan-300">
              {translate(locale, "calendar.tagline", "Agenda Finansial")}
            </p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">{translate(locale, "calendar.title", "Kalender Cashflow")}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {translate(locale, "calendar.subtitle", "Pantau jadwal recurring, payday, dan pengeluaran besar di satu tempat.")}
            </p>
          </div>
          <BackToDashboardButton className="self-start" />
        </header>
        <Suspense
          fallback={
            <div className="rounded-3xl border border-white/20 bg-white/60 p-6 text-sm text-slate-500 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
              {translate(locale, "calendar.loading", "Memuat kalender…")}
            </div>
          }
        >
          <CalendarContent locale={locale} />
        </Suspense>
      </div>
    </main>
  );
}
