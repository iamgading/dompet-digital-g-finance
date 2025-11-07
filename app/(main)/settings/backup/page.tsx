import { BackupManager } from "@/components/settings/backup-manager";
import { BackToDashboardButton } from "@/components/shared/back-to-dashboard";

export default function BackupSettingsPage() {
  return (
    <main className="relative min-h-screen bg-gradient-to-br from-sky-100 via-white to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-50 blur-3xl">
        <div className="mx-auto h-64 w-64 rounded-full bg-cyan-400/30 dark:bg-cyan-500/20" />
      </div>
      <div className="mx-auto w-full max-w-4xl px-6 py-16">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Backup & Restore</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Ekspor data finansial Anda dalam file terenkripsi dan pulihkan kapan saja dengan passphrase.
            </p>
          </div>
          <BackToDashboardButton className="self-start" />
        </header>
        <BackupManager />
      </div>
    </main>
  );
}
