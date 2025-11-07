"use client";

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { useUserPref } from "@/components/providers/user-pref-provider";
import { cn } from "@/lib/utils";

type Pocket = {
  id: string;
  name: string;
  color: string | null;
  monthlyBudget: number;
  balance: number;
  icon?: string | null;
  goalAmount?: number;
  order?: number;
  isActive?: boolean;
};

interface PocketCardProps {
  pocket: Pocket;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onEdit?: (pocket: Pocket) => void;
  onDelete?: (pocket: Pocket) => void;
  onView?: (pocket: Pocket) => void;
}

export function PocketCard({
  pocket,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  onEdit,
  onDelete,
  onView,
}: PocketCardProps) {
  const { formatCurrency } = useUserPref();
  const { name, balance, monthlyBudget, color } = pocket;
  const hasBudget = monthlyBudget > 0;
  const progressValue = hasBudget ? Math.min((balance / monthlyBudget) * 100, 100) : 0;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-white/30 bg-white/70 p-6 shadow-xl backdrop-blur transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(14,165,233,0.25)] dark:border-white/5 dark:bg-white/10",
      )}
      role={onView ? "button" : undefined}
      tabIndex={onView ? 0 : undefined}
      aria-label={onView ? `Buka insight pocket ${name}` : undefined}
      onClick={() => {
        onView?.(pocket);
      }}
      onKeyDown={(event) => {
        if (!onView) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onView(pocket);
        }
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-cyan-500/5 to-cyan-500/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        aria-hidden
      />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-300">{name}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(balance)}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-10 w-10 rounded-full text-slate-500 hover:bg-cyan-500/10 hover:text-cyan-600 focus-visible:ring-cyan-500 dark:text-slate-200 dark:hover:bg-cyan-500/10"
              aria-label={`Opsi untuk pocket ${name}`}
              onClick={(event) => {
                event.stopPropagation();
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-40 rounded-2xl border border-white/40 bg-white/90 p-1.5 text-slate-600 backdrop-blur dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-200"
          >
            {onView ? (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onView(pocket);
                }}
                className="rounded-xl px-3 py-2 text-sm hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-300"
              >
                Lihat Insight
              </DropdownMenuItem>
            ) : null}
            {onEdit ? (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onEdit(pocket);
                }}
                className="rounded-xl px-3 py-2 text-sm hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-300"
              >
                Edit
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              disabled={!onMoveUp || !canMoveUp}
              onSelect={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!onMoveUp || !canMoveUp) {
                  return;
                }
                onMoveUp();
              }}
              className="rounded-xl px-3 py-2 text-sm hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-300"
            >
              Naik
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!onMoveDown || !canMoveDown}
              onSelect={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!onMoveDown || !canMoveDown) {
                  return;
                }
                onMoveDown();
              }}
              className="rounded-xl px-3 py-2 text-sm hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-300"
            >
              Turun
            </DropdownMenuItem>
            {onDelete ? (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDelete(pocket);
                }}
                className="rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-300 dark:hover:bg-rose-500/10"
              >
                Hapus
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasBudget ? (
        <div className="relative mt-6 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-300">
            <span>Anggaran tersisa</span>
            <span>{Math.min(progressValue, 100).toFixed(0)}%</span>
          </div>
          <Progress value={progressValue} className="h-2 overflow-hidden rounded-full bg-slate-200/60" />
        </div>
      ) : (
        <p className="mt-6 text-xs text-slate-400 dark:text-slate-400">Belum ada anggaran bulanan.</p>
      )}

      {color ? (
        <div
          className="absolute inset-0 -z-10 opacity-20 blur-2xl transition-opacity duration-200 group-hover:opacity-40"
          style={{ background: color }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}

export type { Pocket as PocketCardModel };
