"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { Loader2, Lock } from "lucide-react";

import {
  generatePasskeyAuthentication,
  getSecurityStatus,
  verifyPasskeyAuthentication,
  verifyPin,
} from "@/app/actions/security";
import { cn } from "@/lib/utils";

const SESSION_KEY = "gf:security:unlocked";
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

interface SecurityGateProps {
  children: ReactNode;
}

type SecurityStatus = {
  pinEnabled: boolean;
  passkeyRegistered: boolean;
  biometricEnabled: boolean;
};

export function SecurityGate({ children }: SecurityGateProps) {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const securityEnabled = useMemo(
    () => Boolean(status?.pinEnabled || status?.passkeyRegistered),
    [status],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await getSecurityStatus();
        if (!active) return;
        if (result.success) {
          setStatus(result.data);
          setLocked(shouldLockOnLoad(result.data));
        } else {
          console.error(result.error);
          setStatus({
            pinEnabled: false,
            passkeyRegistered: false,
            biometricEnabled: false,
          });
        }
      } catch (error) {
        console.error("[security]", error);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!securityEnabled || locked) {
      clearIdleTimer();
      return;
    }

    const reset = () => resetIdleTimer(() => {
      lock();
    });

    const onVisibility = () => {
      if (document.hidden) {
        lock();
      } else {
        reset();
      }
    };

    const listeners = [
      ["mousemove", reset],
      ["keydown", reset],
      ["touchstart", reset],
      ["visibilitychange", onVisibility],
    ] as const;

    listeners.forEach(([event, handler]) => {
      window.addEventListener(event, handler as EventListener);
    });

    reset();

    return () => {
      clearIdleTimer();
      listeners.forEach(([event, handler]) => {
        window.removeEventListener(event, handler as EventListener);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [securityEnabled, locked]);

  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  };

  const resetIdleTimer = (onTimeout: () => void) => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(onTimeout, IDLE_TIMEOUT_MS);
  };

  const lock = () => {
    clearIdleTimer();
    sessionStorage.removeItem(SESSION_KEY);
    setLocked(true);
  };

  const unlock = () => {
    clearIdleTimer();
    sessionStorage.setItem(SESSION_KEY, Date.now().toString());
    setLocked(false);
    setPin("");
    setError(null);
  };

  const handleSubmit = async () => {
    if (!status?.pinEnabled) return;
    setIsVerifying(true);
    setError(null);
    try {
      const result = await verifyPin({ pin });
      if (!result || typeof result !== "object" || !("success" in result)) {
        setError("Tidak dapat memverifikasi PIN.");
        return;
      }
      if (!result.success) {
        setError(result.error);
        return;
      }
      unlock();
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePasskey = async () => {
    try {
      setIsVerifying(true);
      const optionsResult = await generatePasskeyAuthentication();
      if (!optionsResult.success) {
        setError(optionsResult.error);
        return;
      }
      const assertion = await startAuthentication({ optionsJSON: optionsResult.data });
      const verification = await verifyPasskeyAuthentication({ response: assertion });
      if (!verification.success) {
        setError(verification.error);
        return;
      }
      unlock();
    } catch (error) {
      console.error("[passkey auth]", error);
      setError("Verifikasi passkey gagal.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <>
      {children}
      {securityEnabled && locked ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/95 p-8 shadow-2xl dark:bg-slate-900/95">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
                <Lock className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Terkunci</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">
                Masukkan PIN atau gunakan passkey untuk melanjutkan.
              </p>
            </div>

            {status?.pinEnabled ? (
              <form
                className="mt-6 grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!isVerifying) handleSubmit();
                }}
              >
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                  placeholder="PIN 4-6 digit"
                  className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-center text-lg tracking-widest text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                {error ? <p className="text-sm text-rose-500">{error}</p> : null}
                <button
                  type="submit"
                  className={cn(
                    "inline-flex h-11 items-center justify-center rounded-xl bg-cyan-600 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-cyan-400",
                  )}
                  disabled={isVerifying}
                >
                  {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Buka Kunci
                </button>
              </form>
            ) : null}

            {status?.passkeyRegistered && canUsePasskeyGlobal() ? (
              <button
                type="button"
                onClick={handlePasskey}
                disabled={isVerifying}
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-cyan-500/50 bg-cyan-500/10 text-sm font-medium text-cyan-600 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:text-cyan-400 dark:border-cyan-500/40 dark:text-cyan-200"
              >
                {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Gunakan Passkey
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function shouldLockOnLoad(status: SecurityStatus) {
  if (!status.pinEnabled && !status.passkeyRegistered) return false;
  if (typeof window === "undefined") return true;
  return !sessionStorage.getItem(SESSION_KEY);
}

function canUsePasskeyGlobal() {
  return typeof window !== "undefined" && "PublicKeyCredential" in window;
}
