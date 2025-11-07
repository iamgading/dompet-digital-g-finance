"use client";

import type { ReactNode } from "react";

import { UserPrefProvider } from "@/components/providers/user-pref-provider";
import type { UserPrefSettings } from "@/lib/types/user-pref";

interface AppProvidersProps {
  initialPref: UserPrefSettings;
  children: ReactNode;
}

export function AppProviders({ initialPref, children }: AppProvidersProps) {
  return <UserPrefProvider initialPref={initialPref}>{children}</UserPrefProvider>;
}

