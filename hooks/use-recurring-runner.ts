"use client";

import { useEffect, useRef, useState } from "react";

import { runDueRecurring } from "@/app/actions/recurring";

const STORAGE_KEY = "gf:recurring:last-run";
const THROTTLE_MS = 10 * 60 * 1000;

export function useRecurringRunner() {
  const [isRunning, setIsRunning] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const run = async () => {
      if (typeof window === "undefined") return;
      const now = Date.now();
      const lastRunRaw = sessionStorage.getItem(STORAGE_KEY);
      if (lastRunRaw) {
        const lastRun = Number.parseInt(lastRunRaw, 10);
        if (Number.isFinite(lastRun) && now - lastRun < THROTTLE_MS) {
          return;
        }
      }

      try {
        setIsRunning(true);
        const result = await runDueRecurring();
        if (result.success && result.data.executed.length > 0) {
          sessionStorage.setItem(STORAGE_KEY, String(now));
        } else if (result.success) {
          sessionStorage.setItem(STORAGE_KEY, String(now));
        }
      } catch (error) {
        console.error("[recurring runner]", error);
      } finally {
        setIsRunning(false);
      }
    };

    run().catch((error) => console.error("[recurring runner]", error));
  }, []);

  return { isRunning };
}

