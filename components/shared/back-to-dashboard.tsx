"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/use-i18n";

interface BackToDashboardButtonProps {
  className?: string;
  label?: string;
}

export function BackToDashboardButton({ className, label }: BackToDashboardButtonProps) {
  const { t } = useI18n();
  const resolvedLabel = label ?? t("backToDashboard", "Kembali ke Dashboard");
  return (
    <Button
      asChild
      variant="ghost"
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border border-transparent bg-transparent px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-200 hover:bg-white/80 hover:text-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900/60 dark:hover:text-slate-100",
        className,
      )}
    >
      <Link href="/">
        <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
        {resolvedLabel}
      </Link>
    </Button>
  );
}
