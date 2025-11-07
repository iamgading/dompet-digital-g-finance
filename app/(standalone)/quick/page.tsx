import { listPockets } from "@/app/actions/finance";
import { SyncStatusBadge } from "@/components/shared/sync-status-badge";
import { BackToDashboardButton } from "@/components/shared/back-to-dashboard";
import { QuickAddTransactionDialog } from "@/components/transactions/quick-add-transaction-dialog";
import { getActiveProfile, listProfiles } from "@/app/actions/profile";
import { ProfileSwitcherStandalone } from "@/components/profile/profile-switcher-standalone";

export default async function QuickAddPage() {
  const [pocketsResult, activeProfileResult, profilesResult] = await Promise.all([
    listPockets(),
    getActiveProfile(),
    listProfiles(),
  ]);
  if (!pocketsResult.success) {
    throw new Error(pocketsResult.error);
  }

  if (!activeProfileResult.success) {
    throw new Error(activeProfileResult.error);
  }

  if (!profilesResult.success) {
    throw new Error(profilesResult.error);
  }

  const pocketOptions = pocketsResult.data.map((pocket) => ({
    id: pocket.id,
    name: pocket.name,
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

  return (
    <main className="flex min-h-screen flex-col justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 px-6 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackToDashboardButton className="bg-white/10 text-white hover:bg-white/20" label="Kembali" />
          <div className="flex items-center gap-3">
            <ProfileSwitcherStandalone
              initialActiveProfile={activeProfile}
              initialProfiles={profiles}
            />
            <SyncStatusBadge />
          </div>
        </div>
        <QuickAddTransactionDialog pockets={pocketOptions} variant="inline" triggerLabel="Quick Add" />
      </div>
    </main>
  );
}
