"use client";

import { useEffect, useTransition, useState } from "react";
import { useTheme } from "next-themes";

import { updateUserPref } from "@/app/actions/user-pref";
import { useUserPref } from "@/components/providers/user-pref-provider";
import type { UserPrefSettings } from "@/lib/types/user-pref";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/use-i18n";

const currencyOptions: Array<{ value: UserPrefSettings["currency"]; label: string }> = [
  { value: "IDR", label: "Rupiah (IDR)" },
  { value: "USD", label: "US Dollar (USD)" },
];

const localeOptions: Array<{ value: UserPrefSettings["locale"]; label: string }> = [
  { value: "id-ID", label: "Indonesia" },
  { value: "en-US", label: "English" },
];

const themeOptions: Array<{ value: UserPrefSettings["theme"]; label: string }> = [
  { value: "system", label: "Sistem" },
  { value: "light", label: "Terang" },
  { value: "dark", label: "Gelap" },
];

interface ProfileSettingsProps {
  initialPref: UserPrefSettings;
}

export function ProfileSettings({ initialPref }: ProfileSettingsProps) {
  const { pref, setPref, replacePref, formatCurrency, formatDate } = useUserPref();
  const { t } = useI18n();
  const resolvedLocaleOptions: typeof localeOptions = pref.locale.startsWith("en")
    ? [
        { value: "id-ID", label: "Indonesian" },
        { value: "en-US", label: "English" },
      ]
    : localeOptions;
  const { setTheme } = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    replacePref(initialPref);
    setTheme(initialPref.theme);
  }, [initialPref, replacePref, setTheme]);

  const handleChange = (patch: Partial<UserPrefSettings>) => {
    const prevPref = pref;
    const nextPref: UserPrefSettings = {
      ...pref,
      ...patch,
    };

    if (patch.theme && patch.theme !== prevPref.theme) {
      setTheme(patch.theme);
    }

    setPref(nextPref);
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await updateUserPref({
        currency: nextPref.currency,
        locale: nextPref.locale,
        theme: nextPref.theme,
        uiAnimationsEnabled: nextPref.uiAnimationsEnabled,
      });

      if (!result.success) {
        replacePref(prevPref);
        if (prevPref.theme !== nextPref.theme) {
          setTheme(prevPref.theme);
        }
        setError(result.error ?? t("settings.error", "Gagal menyimpan preferensi."));
        return;
      }

      replacePref(result.data.pref);
      setMessage(t("settings.saved", "Preferensi berhasil disimpan."));
    });
  };

  const previewAmount = formatCurrency(1_250_000);
  const previewDate = formatDate(new Date(), { dateStyle: "long" });

  return (
    <div className="grid gap-8">
      <section className="rounded-3xl border border-white/40 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-white/10">
        <header className="mb-6 space-y-2">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t("settings.preferences", "Preferensi Tampilan")}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            {t(
              "settings.preferencesDesc",
              "Atur format mata uang, bahasa, tema, dan animasi. Perubahan disimpan otomatis dan langsung terlihat.",
            )}
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="grid gap-4">
            <SettingSelect
              id="currency"
              label={t("settings.currency", "Mata Uang")}
              value={pref.currency}
              onChange={(value) => handleChange({ currency: value })}
              disabled={isPending}
              options={currencyOptions}
            />
            <SettingSelect
              id="locale"
              label={t("settings.language", "Bahasa & Format Regional")}
              value={pref.locale}
              onChange={(value) => handleChange({ locale: value })}
              disabled={isPending}
              options={resolvedLocaleOptions}
            />
            <SettingSelect
              id="theme"
              label={t("settings.theme", "Tema Default")}
              value={pref.theme}
              onChange={(value) => handleChange({ theme: value })}
              disabled={isPending}
              options={themeOptions}
            />
            <SettingToggle
              id="animations"
              label={t("settings.animations", "Animasi UI")}
              description={t("settings.animationsDesc", "Nonaktifkan untuk mengurangi gerakan berlebihan.")}
              checked={pref.uiAnimationsEnabled}
              onChange={(checked) => handleChange({ uiAnimationsEnabled: checked })}
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col justify-between gap-6 rounded-2xl border border-slate-200/70 bg-white/90 p-6 dark:border-white/5 dark:bg-slate-900/40">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">{t("settings.previewTitle", "Preview")}</h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                {t("settings.previewSubtitle", "Tampilan angka dan tanggal mengikuti preferensi terbaru.")}
              </p>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-100">
                <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-300">Saldo Contoh</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{previewAmount}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Diperbarui {previewDate}</p>
              </div>
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 text-cyan-700 shadow-sm dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200">
                <p className="text-xs font-medium uppercase tracking-wide">{t("settings.statusTitle", "Status Animasi")}</p>
                <p className="mt-2 text-sm">
                  {pref.uiAnimationsEnabled
                    ? t("settings.statusEnabled", "Animasi aktif untuk pengalaman yang lebih hidup.")
                    : t("settings.statusDisabled", "Animasi diminimalkan untuk pengalaman yang lebih tenang.")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-6 space-y-2 text-sm">
          {message ? <p className="text-emerald-600 dark:text-emerald-300">{message}</p> : null}
          {error ? <p className="text-rose-500 dark:text-rose-300">{error}</p> : null}
          {isPending ? <p className="text-slate-400">{t("settings.saving", "Menyimpan perubahan...")}</p> : null}
        </footer>
      </section>
    </div>
  );
}

interface SettingSelectProps<Option extends { value: string; label: string }> {
  id: string;
  label: string;
  value: Option["value"];
  onChange: (value: Option["value"]) => void;
  disabled?: boolean;
  options: Option[];
}

function SettingSelect<Option extends { value: string; label: string }>({ id, label, value, onChange, disabled, options }: SettingSelectProps<Option>) {
  return (
    <label htmlFor={id} className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
      {label}
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as Option["value"])}
        className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface SettingToggleProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function SettingToggle({ id, label, description, checked, onChange, disabled }: SettingToggleProps) {
  return (
    <div className="flex items-start justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-100">
          {label}
        </label>
        {description ? <p className="text-xs text-slate-500 dark:text-slate-300">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-7 w-14 items-center rounded-full border transition",
          checked
            ? "border-cyan-500 bg-cyan-500/20"
            : "border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span
          className={cn(
            "inline-block h-6 w-6 transform rounded-full bg-white shadow transition",
            checked ? "translate-x-7" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}
