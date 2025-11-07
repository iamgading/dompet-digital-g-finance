"use client";

import { useCallback } from "react";

import { useUserPref } from "@/components/providers/user-pref-provider";
import { translate } from "@/lib/i18n";

export function useI18n() {
  const { pref } = useUserPref();
  const t = useCallback(
    (key: string, fallback: string) => translate(pref.locale, key, fallback),
    [pref.locale],
  );

  return { locale: pref.locale, t };
}
