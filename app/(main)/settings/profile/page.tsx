import { getCachedUserPref } from "@/app/actions/user-pref";
import { BackToDashboardButton } from "@/components/shared/back-to-dashboard";
import { ProfileSettings } from "@/components/settings/profile-settings";

export default async function ProfileSettingsPage() {
  const pref = await getCachedUserPref();

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-sky-100 via-white to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-50 blur-3xl">
        <div className="mx-auto h-64 w-64 rounded-full bg-cyan-400/30 dark:bg-cyan-500/20" />
      </div>
      <div className="mx-auto w-full max-w-4xl px-6 py-16">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Tampilan & Profil</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Sesuaikan mata uang, bahasa, serta tema default. Preferensi disimpan ke profil dan sinkron di semua perangkat.
            </p>
          </div>
          <BackToDashboardButton className="self-start" />
        </div>
        <ProfileSettings initialPref={pref} />
      </div>
    </main>
  );
}
