"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { CashflowRangePreset } from "@/app/actions/analytics";
import { cn } from "@/lib/utils";

interface CashflowRangePickerProps {
  options: Array<{ id: CashflowRangePreset; label: string }>;
  currentRange: CashflowRangePreset;
  defaultRange: CashflowRangePreset;
}

export function CashflowRangePicker({ options, currentRange, defaultRange }: CashflowRangePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function handleSelect(range: CashflowRangePreset) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (range === defaultRange) {
        params.delete("cashflowRange");
      } else {
        params.set("cashflowRange", range);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = option.id === currentRange;
        return (
          <button
            key={option.id}
            type="button"
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
              isActive
                ? "border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:border-cyan-400 dark:text-cyan-200"
                : "border-slate-200 bg-white/70 text-slate-600 hover:border-cyan-300 hover:text-cyan-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
              pending && "opacity-60",
            )}
            onClick={() => handleSelect(option.id)}
            disabled={pending}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
