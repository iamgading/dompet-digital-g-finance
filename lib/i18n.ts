const EN_TRANSLATIONS: Record<string, string> = {
  "dashboard.totalBalance": "Total Balance",
  "dashboard.profile": "Profile",
  "dashboard.addPocket": "Add Pocket",
  "dashboard.featureSection": "Power Features",
  "feature.import.title": "Import CSV",
  "feature.import.description": "Pull bank statements, auto-categorize, and review before committing.",
  "feature.recurring.title": "Recurring",
  "feature.recurring.description": "Set weekly/monthly schedules and trigger whenever you need.",
  "feature.security.title": "PIN & Passkey",
  "feature.security.description": "Enable PIN lock and fast login with passkeys.",
  "feature.backup.title": "Encrypted Backup",
  "feature.backup.description": "Export & restore data with AES-GCM protection.",
  "feature.reports.title": "Financial Reports",
  "feature.reports.description": "Download CSV or PDF summaries for any period.",
  "feature.calendar.title": "Cashflow Calendar",
  "feature.calendar.description": "See recurring items, paydays, and big expenses in one calendar.",
  "transactions.sectionTitle": "Transaction History",
  "transactions.show": "Show History",
  "transactions.hide": "Hide History",
  "transactions.empty": "No transactions recorded yet.",
  "transactions.error": "Failed to load recent transactions.",
  "transactions.loading": "Loading recent transactions...",
  "transactions.sectionSubtitle": "Toggle the list only when needed to keep the dashboard clean.",
  "transactions.quickAdd": "Quick Transaction",
  "transactions.amountLabel": "Amount",
  "transactions.typeLabel": "Type",
  "transactions.income": "Income",
  "transactions.expense": "Expense",
  "transactions.pocketLabel": "Pocket",
  "transactions.noteLabel": "Note",
  "transactions.notePlaceholder": "(Optional)",
  "transactions.cancel": "Cancel",
  "transactions.save": "Save",
  "transactions.reset": "Reset",
  "transactions.dialogTitle": "Add Transaction",
  "transactions.inlineTitle": "Quick Add",
  "transactions.inlineSubtitle": "Add light transactions anytime, even offline.",
  "cashflow.title": "Cashflow",
  "cashflow.subtitle": "Income, expenses, and cumulative balance for your chosen range.",
  "cashflow.loading": "Loading cashflow chart...",
  "cashflow.error": "Failed to load cashflow data.",
  "calendar.title": "Cashflow Calendar",
  "calendar.subtitle": "Track recurring payments, paydays, and major expenses at a glance.",
  "calendar.empty": "Nothing to show yet. Add transactions or recurring schedules to see them here.",
  "calendar.tagline": "Financial Agenda",
  "calendar.loading": "Loading calendar…",
  "settings.preferences": "Display Preferences",
  "settings.preferencesDesc": "Set currency format, language, theme, and animations. Changes auto-save.",
  "settings.currency": "Currency",
  "settings.language": "Language & Region",
  "settings.theme": "Default Theme",
  "settings.animations": "UI Animations",
  "settings.animationsDesc": "Disable to reduce excessive motion.",
  "settings.previewTitle": "Preview",
  "settings.previewSubtitle": "Numbers and dates follow the latest preference.",
  "settings.statusTitle": "Animation Status",
  "settings.statusEnabled": "Animations are enabled for a lively experience.",
  "settings.statusDisabled": "Animations are minimized for a calmer feel.",
  "settings.saving": "Saving changes...",
  "settings.saved": "Preferences saved.",
  "settings.error": "Failed to save preferences.",
  "backToDashboard": "Back to Dashboard",
  "assistant.link": "Assistant",
  "language.toggle": "Language",
  "insight.title": "Today's Insight",
  "insight.empty": "No specific insight today. Keep up the good habits!",
  "insight.loading": "Preparing insights...",
};

export const LANGUAGE_OPTIONS = [
  { locale: "id-ID", label: "Bahasa Indonesia", shortLabel: "ID" },
  { locale: "en-US", label: "English", shortLabel: "EN" },
] as const;

export type SupportedLocale = (typeof LANGUAGE_OPTIONS)[number]["locale"];

export function normalizeLocale(locale: string): SupportedLocale {
  return locale.startsWith("en") ? "en-US" : "id-ID";
}

export function translate(locale: string, key: string, fallback: string) {
  const normalized = normalizeLocale(locale);
  if (normalized === "en-US") {
    return EN_TRANSLATIONS[key] ?? fallback;
  }
  return fallback;
}
