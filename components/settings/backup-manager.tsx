"use client";

import { useRef, useState, useTransition } from "react";

import { exportBackupData, restoreBackupData } from "@/app/actions/backup";
import { decryptJson, encryptJson, type EncryptedPayload } from "@/lib/crypto";
import type { BackupPayload } from "@/lib/validators";

interface BackupFile {
  version: number;
  createdAt: string;
  payload: EncryptedPayload;
}

export function BackupManager() {
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [backupConfirm, setBackupConfirm] = useState("");
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleBackup = () => {
    setError(null);
    setMessage(null);
    if (backupPassphrase.length < 6) {
      setError("Passphrase minimal 6 karakter.");
      return;
    }
    if (backupPassphrase !== backupConfirm) {
      setError("Konfirmasi passphrase tidak cocok.");
      return;
    }

    startTransition(async () => {
      const dataResult = await exportBackupData();
      if (!dataResult.success) {
        setError(dataResult.error);
        return;
      }

      const encrypted = await encryptJson(dataResult.data, backupPassphrase);
      const backupFile: BackupFile = {
        version: 1,
        createdAt: new Date().toISOString(),
        payload: encrypted,
      };

      const blob = new Blob([JSON.stringify(backupFile, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `g-finance-backup-${new Date().toISOString()}.gfin.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Backup terenkripsi telah diunduh.");
    });
  };

  const handleRestore = () => {
    setError(null);
    setMessage(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Pilih file backup terlebih dahulu.");
      return;
    }
    if (!restorePassphrase) {
      setError("Passphrase diperlukan untuk restore.");
      return;
    }

    startTransition(async () => {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as BackupFile;
        if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
          setError("File backup tidak valid atau versi tidak didukung.");
          return;
        }
        const data = await decryptJson<BackupPayload>(parsed.payload, restorePassphrase);
        const result = await restoreBackupData({ payload: data });
        if (!result.success) {
          setError(result.error);
          return;
        }
        setMessage("Restore berhasil. Silakan refresh atau kembali ke dashboard.");
      } catch (error) {
        console.error("[restore]", error);
        setError("Restore gagal. Pastikan file dan passphrase benar.");
      }
    });
  };

  return (
    <div className="grid gap-8">
      <section className="rounded-3xl border border-white/40 bg-white/70 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-white/10">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Backup terenkripsi</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
          Masukkan passphrase untuk mengenkripsi backup. Simpan passphrase ini karena tidak disimpan di server.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
            Passphrase
            <input
              type="password"
              value={backupPassphrase}
              onChange={(event) => setBackupPassphrase(event.target.value)}
              placeholder="Minimal 6 karakter"
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
            Konfirmasi Passphrase
            <input
              type="password"
              value={backupConfirm}
              onChange={(event) => setBackupConfirm(event.target.value)}
              placeholder="Ulangi passphrase"
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleBackup}
          disabled={isPending}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-cyan-600 px-6 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-cyan-400"
        >
          {isPending ? "Memproses..." : "Backup JSON (Encrypted)"}
        </button>
      </section>

      <section className="rounded-3xl border border-white/40 bg-white/70 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-white/10">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Restore data</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
          Pilih file .gfin.json dan masukkan passphrase untuk mengembalikan data. Operasi ini akan menggantikan data saat ini.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
            File backup
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
            Passphrase
            <input
              type="password"
              value={restorePassphrase}
              onChange={(event) => setRestorePassphrase(event.target.value)}
              placeholder="Passphrase backup"
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleRestore}
          disabled={isPending}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-6 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-400/40 dark:text-emerald-200"
        >
          {isPending ? "Memproses..." : "Restore"}
        </button>
      </section>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-600">{message}</div> : null}
    </div>
  );
}
