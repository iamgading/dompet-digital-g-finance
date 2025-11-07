"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";

import { updateUserPref } from "@/app/actions/user-pref";
import { useUserPref } from "@/components/providers/user-pref-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGE_OPTIONS, normalizeLocale, translate, type SupportedLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type LanguageOption = {
  locale: SupportedLocale;
  label: string;
  shortLabel?: string;
};

export function LanguageToggle() {
  const { pref, setPref, replacePref } = useUserPref();
  const [isPending, startTransition] = useTransition();
  const languageOptions = LANGUAGE_OPTIONS as readonly LanguageOption[];
  const current = normalizeLocale(pref.locale);
  const currentOption: LanguageOption = languageOptions.find((option) => option.locale === current) ?? languageOptions[0];

  const handleChange = (nextLocale: (typeof LANGUAGE_OPTIONS)[number]["locale"]) => {
    if (nextLocale === pref.locale) return;
    const previous = pref;
    setPref({ ...previous, locale: nextLocale });

    startTransition(async () => {
      const result = await updateUserPref({
        currency: previous.currency,
        locale: nextLocale,
        theme: previous.theme,
        uiAnimationsEnabled: previous.uiAnimationsEnabled,
      });

      if (!result.success) {
        replacePref(previous);
        return;
      }
      replacePref(result.data.pref);
    });
  };

  const buttonLabel =
    currentOption.shortLabel ?? (currentOption.locale.startsWith("en") ? "EN" : currentOption.locale.startsWith("id") ? "ID" : "??");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-10 w-10 rounded-full border border-transparent text-slate-600 transition hover:border-slate-200 hover:bg-white/80 hover:text-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900/60 dark:hover:text-slate-100",
            isPending && "opacity-70",
          )}
          aria-label={translate(pref.locale, "language.toggle", "Ubah bahasa")}
          disabled={isPending}
        >
          <Languages className="h-5 w-5" />
          <span className="sr-only">{translate(pref.locale, "language.toggle", "Ubah bahasa")}</span>
          <span className="pointer-events-none absolute -bottom-1 right-1 rounded-full bg-cyan-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {buttonLabel}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-2xl border border-white/40 bg-white/95 p-1.5 text-sm shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/95">
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
          {translate(pref.locale, "language.toggle", "Ubah bahasa")}
        </DropdownMenuLabel>
        {languageOptions.map((option) => (
          <DropdownMenuItem
            key={option.locale}
            className={cn(
              "flex items-center justify-between rounded-xl px-3 py-2 text-slate-700 transition hover:bg-cyan-500/10 dark:text-slate-100 dark:hover:bg-cyan-500/20",
              option.locale === current && "bg-cyan-500/10 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200",
            )}
            onSelect={(event) => {
              event.preventDefault();
              handleChange(option.locale);
            }}
          >
            <span>{option.label}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">{option.shortLabel}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
