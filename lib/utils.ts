import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type CurrencyOptions = {
  locale?: string;
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatCurrency(value: number, options: CurrencyOptions = {}) {
  const locale = options.locale ?? "id-ID";
  const currency = options.currency ?? "IDR";
  const key = `${locale}|${currency}|${options.minimumFractionDigits ?? "default"}|${options.maximumFractionDigits ?? "default"}`;
  let formatter = currencyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: options.minimumFractionDigits,
      maximumFractionDigits:
        options.maximumFractionDigits ?? (currency === "USD" ? 2 : 0),
    });
    currencyFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

export function formatCurrencyIDR(value: number) {
  return formatCurrency(value, { currency: "IDR", locale: "id-ID", maximumFractionDigits: 0 });
}
