"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { defaultUserPref, type UserPrefSettings } from "@/lib/types/user-pref";

type UserPrefContextValue = {
  pref: UserPrefSettings;
  setPref: (patch: Partial<UserPrefSettings>) => void;
  replacePref: (next: UserPrefSettings) => void;
  formatCurrency: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (input: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  animationsEnabled: boolean;
};

const UserPrefContext = createContext<UserPrefContextValue | null>(null);

interface UserPrefProviderProps {
  initialPref?: UserPrefSettings | null;
  children: ReactNode;
}

function resolveInitialPref(pref?: UserPrefSettings | null): UserPrefSettings {
  if (!pref) return { ...defaultUserPref };
  return {
    ...defaultUserPref,
    ...pref,
  };
}

export function UserPrefProvider({ initialPref, children }: UserPrefProviderProps) {
  const [pref, setPrefState] = useState<UserPrefSettings>(() => resolveInitialPref(initialPref));

  const setPref = useCallback((patch: Partial<UserPrefSettings>) => {
    setPrefState((previous) => ({
      ...previous,
      ...patch,
    }));
  }, []);

  const replacePref = useCallback((next: UserPrefSettings) => {
    setPrefState(resolveInitialPref(next));
  }, []);

  const formatCurrency = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => {
      return new Intl.NumberFormat(pref.locale, {
        style: "currency",
        currency: pref.currency,
        maximumFractionDigits: pref.currency === "USD" ? 2 : 0,
        ...options,
      }).format(value);
    },
    [pref.currency, pref.locale],
  );

  const formatDate = useCallback(
    (input: Date | string, options?: Intl.DateTimeFormatOptions) => {
      const date = input instanceof Date ? input : new Date(input);
      if (Number.isNaN(date.getTime())) {
        return "";
      }
      return new Intl.DateTimeFormat(pref.locale, options ?? { dateStyle: "medium" }).format(date);
    },
    [pref.locale],
  );

  const value = useMemo<UserPrefContextValue>(() => {
    return {
      pref,
      setPref,
      replacePref,
      formatCurrency,
      formatDate,
      animationsEnabled: pref.uiAnimationsEnabled,
    };
  }, [formatCurrency, formatDate, pref, replacePref, setPref]);

  return <UserPrefContext.Provider value={value}>{children}</UserPrefContext.Provider>;
}

export function useUserPref() {
  const context = useContext(UserPrefContext);
  if (!context) {
    throw new Error("useUserPref must be used within a UserPrefProvider");
  }
  return context;
}

