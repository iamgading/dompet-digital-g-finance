import { Suspense } from "react";

import { HomeDashboard } from "@/components/home/home-dashboard";
import { getTotalBalance, listPockets } from "@/app/actions/finance";
import { getActiveProfile, listProfiles } from "@/app/actions/profile";
import { CashflowSection, CashflowFallback } from "@/components/home/cashflow-section";
import { InsightSection, InsightFallback } from "@/components/home/insight-section";
import { RecentTransactionsSection, RecentTransactionsFallback } from "@/components/home/recent-transactions-section";
import type { CashflowRangePreset } from "@/app/actions/analytics";
import { getCachedUserPref } from "@/app/actions/user-pref";

type HomePageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function parseCashflowRange(searchParams?: Record<string, string | string[] | undefined>): CashflowRangePreset | undefined {
  if (!searchParams) return undefined;
  const raw = searchParams.cashflowRange;
  if (typeof raw !== "string") return undefined;
  if (raw === "30d" || raw === "90d" || raw === "180d" || raw === "ytd") {
    return raw;
  }
  return undefined;
}

export default async function Home({ searchParams }: HomePageProps) {
  const selectedCashflowRange = parseCashflowRange(searchParams);
  const [totalResult, pocketsResult, activeProfileResult, profilesResult, userPref] = await Promise.all([
    getTotalBalance(),
    listPockets(),
    getActiveProfile(),
    listProfiles(),
    getCachedUserPref(),
  ]);

  if (!totalResult.success) {
    throw new Error(totalResult.error);
  }

  if (!pocketsResult.success) {
    throw new Error(pocketsResult.error);
  }

  if (!activeProfileResult.success) {
    throw new Error(activeProfileResult.error);
  }

  if (!profilesResult.success) {
    throw new Error(profilesResult.error);
  }

  const activeProfile = {
    id: activeProfileResult.data.id,
    name: activeProfileResult.data.name,
    desc: activeProfileResult.data.desc ?? null,
  };

  const profiles = profilesResult.data.map((profile) => ({
    id: profile.id,
    name: profile.name,
    desc: profile.desc ?? null,
  }));

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-sky-100 via-white to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60 blur-3xl">
        <div className="mx-auto h-64 w-64 rounded-full bg-cyan-400/30 dark:bg-cyan-500/20" />
      </div>

      <HomeDashboard
        initialTotal={totalResult.data.total}
        initialPockets={pocketsResult.data}
        activeProfile={activeProfile}
        profiles={profiles}
        recentTransactions={
          <Suspense fallback={<RecentTransactionsFallback locale={userPref.locale} />}>
            <RecentTransactionsSection locale={userPref.locale} />
          </Suspense>
        }
      >
        <Suspense fallback={<CashflowFallback locale={userPref.locale} />}>
          <CashflowSection locale={userPref.locale} range={selectedCashflowRange} />
        </Suspense>
        <Suspense fallback={<InsightFallback locale={userPref.locale} />}>
          <InsightSection locale={userPref.locale} />
        </Suspense>
      </HomeDashboard>
    </main>
  );
}
