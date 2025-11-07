import { listPockets } from "@/app/actions/finance";
import { listRecurring } from "@/app/actions/recurring";
import { getActiveProfile, listProfiles } from "@/app/actions/profile";
import { RecurringManager } from "@/components/recurring/recurring-manager";
import { BackToDashboardButton } from "@/components/shared/back-to-dashboard";
import { ProfileSwitcherStandalone } from "@/components/profile/profile-switcher-standalone";

export default async function RecurringPage() {
  const [pocketsResult, recurringResult, activeProfileResult, profilesResult] = await Promise.all([
    listPockets(),
    listRecurring(),
    getActiveProfile(),
    listProfiles(),
  ]);

  if (!pocketsResult.success) {
    throw new Error(pocketsResult.error);
  }

  if (!recurringResult.success) {
    throw new Error(recurringResult.error);
  }

  if (!activeProfileResult.success) {
    throw new Error(activeProfileResult.error);
  }

  if (!profilesResult.success) {
    throw new Error(profilesResult.error);
  }

  const pockets = pocketsResult.data.map((pocket) => ({
    id: pocket.id,
    name: pocket.name,
    color: pocket.color,
  }));

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

  const items = recurringResult.data.map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type as "income" | "expense",
    amount: item.amount,
    pocketId: item.pocketId,
    pocketName: item.pocket?.name ?? "Pocket",
    schedule: item.schedule,
    autoPost: item.autoPost,
    nextRunAt: new Date(item.nextRunAt).toISOString(),
  }));

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-sky-100 via-white to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-50 blur-3xl">
        <div className="mx-auto h-64 w-64 rounded-full bg-cyan-400/30 dark:bg-cyan-500/20" />
      </div>
      <div className="mx-auto w-full max-w-5xl px-6 py-16">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Recurring Transactions</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Otomatiskan transaksi rutin seperti gaji mingguan, uang saku, dan langganan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ProfileSwitcherStandalone
              initialActiveProfile={activeProfile}
              initialProfiles={profiles}
            />
            <BackToDashboardButton />
          </div>
        </header>
        <RecurringManager pockets={pockets} initialItems={items} />
      </div>
    </main>
  );
}
