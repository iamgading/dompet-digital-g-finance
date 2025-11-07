"use client";

import { useState, useTransition } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { Loader2, ShieldCheck } from "lucide-react";

import {
  clearPin,
  generatePasskeyRegistration,
  removePasskey,
  setPin,
  verifyPasskeyRegistration,
} from "@/app/actions/security";

type SecurityStatus = {
  pinEnabled: boolean;
  passkeyRegistered: boolean;
};

interface SecuritySettingsProps {
  initialStatus: SecurityStatus;
}

export function SecuritySettings({ initialStatus }: SecuritySettingsProps) {
  const [status, setStatus] = useState(initialStatus);
  const [pin, setPinValue] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSetPin = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await setPin({ pin, confirmPin });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setStatus((prev) => ({ ...prev, pinEnabled: true }));
      setPinValue("");
      setConfirmPin("");
      setMessage("PIN berhasil disimpan.");
    });
  };

  const handleClearPin = () => {
    startTransition(async () => {
      const result = await clearPin();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setStatus((prev) => ({ ...prev, pinEnabled: false }));
      setMessage("PIN dihapus. Aplikasi tidak lagi terkunci otomatis.");
    });
  };

  const handleRegisterPasskey = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const optionsResult = await generatePasskeyRegistration();
        if (!optionsResult.success) {
          setError(optionsResult.error);
          return;
        }
        const attestation = await startRegistration({ optionsJSON: optionsResult.data });
        const verification = await verifyPasskeyRegistration({ response: attestation });
        if (!verification.success) {
          setError(verification.error);
          return;
        }
        setStatus((prev) => ({ ...prev, passkeyRegistered: true }));
        setMessage("Passkey berhasil didaftarkan.");
      } catch (error) {
        console.error("[passkey register]", error);
        setError("Registrasi passkey gagal. Coba lagi.");
      }
    });
  };

  const handleRemovePasskey = () => {
    startTransition(async () => {
      const result = await removePasskey();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setStatus((prev) => ({ ...prev, passkeyRegistered: false }));
      setMessage("Passkey dihapus.");
    });
  };

  return (
    <div className="grid gap-8">
      <section className="rounded-3xl border border-white/40 bg-white/70 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-white/10">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Kunci PIN</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
          Tambahkan PIN untuk mengunci aplikasi saat dibuka atau setelah idle.
        </p>

        <form
          className="mt-5 grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isPending) handleSetPin();
          }}
        >
          <label className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
            PIN baru
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(event) => setPinValue(event.target.value)}
              placeholder="******"
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
            Konfirmasi PIN
            <input
              type="password"
              inputMode="numeric"
              value={confirmPin}
              onChange={(event) => setConfirmPin(event.target.value)}
              placeholder="Ulangi PIN"
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-cyan-600 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-cyan-400 md:col-span-2"
            disabled={isPending}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Simpan PIN
          </button>
        </form>

        {status.pinEnabled ? (
          <button
            type="button"
            onClick={handleClearPin}
            disabled={isPending}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-rose-300 bg-rose-50 px-4 text-sm font-medium text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
          >
            Hapus PIN
          </button>
        ) : null}
      </section>

      <section className="rounded-3xl border border-white/40 bg-white/70 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-white/10">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Passkey / WebAuthn</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
          Gunakan biometrik/perangkat untuk membuka kunci lebih cepat. Passkey tersimpan aman di perangkat Anda.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRegisterPasskey}
            disabled={isPending || !canUsePasskey()}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {status.passkeyRegistered ? "Perbarui Passkey" : "Daftarkan Passkey"}
          </button>
          {status.passkeyRegistered ? (
            <button
              type="button"
              onClick={handleRemovePasskey}
              disabled={isPending}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-300 bg-rose-50 px-5 text-sm font-medium text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
            >
              Hapus Passkey
            </button>
          ) : null}
          {!canUsePasskey() ? (
            <span className="text-sm text-slate-400">
              Perangkat atau browser Anda belum mendukung Passkey.
            </span>
          ) : null}
        </div>
      </section>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</div> : null}
      {message ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-600">
          <ShieldCheck className="h-4 w-4" />
          {message}
        </div>
      ) : null}
    </div>
  );
}

function canUsePasskey() {
  return typeof window !== "undefined" && "PublicKeyCredential" in window;
}
