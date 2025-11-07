"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  HardDriveDownload,
  Repeat,
  ShieldCheck,
  UploadCloud,
  Plus,
  Loader2,
  History,
  AlertTriangle,
  Trash2,
  ChevronDown,
  FileText,
  CalendarClock,
} from "lucide-react";

import { QuickAddTransactionDialog } from "@/components/transactions/quick-add-transaction-dialog";
import {
  TransferDialog,
  type TransferActionResult,
  type TransferOptimisticPayload,
} from "@/components/transactions/transfer-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OnlineBadge } from "@/components/shared/online-badge";
import { SyncStatusBadge } from "@/components/shared/sync-status-badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { PocketGrid } from "@/components/pockets/pocket-grid";
import { PocketInsight } from "@/components/pockets/pocket-insight";
import { reorderPockets, upsertPocket, deletePocket } from "@/app/actions/finance";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useUserPref } from "@/components/providers/user-pref-provider";
import type { TxnCreateInput } from "@/lib/validators";
import { ProfileSwitcher } from "@/components/profile/profile-switcher";
import type { ProfileInfo } from "@/lib/types/profile";
import { useI18n } from "@/hooks/use-i18n";

type Pocket = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  monthlyBudget: number;
  goalAmount: number;
  order: number;
  isActive: boolean;
  balance: number;
};

interface HomeDashboardProps {
  initialTotal: number;
  initialPockets: Pocket[];
  activeProfile: ProfileInfo;
  profiles: ProfileInfo[];
  children?: React.ReactNode;
  recentTransactions?: ReactNode;
}

type CreateTransactionResult =
  | { success: true; data: { pocket: Pocket; total: number } }
  | { success: false; error: string };

type OptimisticState = {
  pocketId: string;
  delta: number;
} | null;

type NotificationState = { type: "success" | "error"; message: string } | null;

export function HomeDashboard({
  initialTotal,
  initialPockets,
  activeProfile,
  profiles,
  children,
  recentTransactions,
}: HomeDashboardProps) {
  const { formatCurrency } = useUserPref();
  const { t } = useI18n();
  const router = useRouter();
  const [total, setTotal] = useState(initialTotal);
  const [pockets, setPockets] = useState(initialPockets);
  const [lastOptimistic, setLastOptimistic] = useState<OptimisticState>(null);
  const [lastTransferOptimistic, setLastTransferOptimistic] = useState<TransferOptimisticPayload | null>(
    null,
  );
  const [notification, setNotification] = useState<NotificationState>(null);
  const [showTransactions, setShowTransactions] = useState(false);
  const [insightOpen, setInsightOpen] = useState(false);
  const [insightPocketId, setInsightPocketId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Pocket | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPocket, setEditingPocket] = useState<Pocket | null>(null);
  const [pocketForm, setPocketForm] = useState({ name: "", color: "#0ea5e9", monthlyBudget: "", goalAmount: "" });
  const [pocketError, setPocketError] = useState<string | null>(null);
  const [isPocketMutating, startPocketMutation] = useTransition();
  const renderStartRef = useRef<number>(typeof performance !== "undefined" ? performance.now() : 0);
  const [activeProfileState, setActiveProfileState] = useState(activeProfile);
  const [profileList, setProfileList] = useState(profiles);

  const showNotification = useCallback((feedback: NotificationState) => {
    if (!feedback) return;
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    setNotification(feedback);
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null);
      notificationTimeoutRef.current = null;
    }, 3200);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && typeof performance !== "undefined") {
      const duration = performance.now() - renderStartRef.current;
      const label = `[home-dashboard] render ${duration.toFixed(2)}ms`;
      if (duration > 100) {
        console.warn(label);
      } else {
        console.log(label);
      }
    }
  });

  useEffect(() => {
    setActiveProfileState(activeProfile);
  }, [activeProfile]);

  useEffect(() => {
    setProfileList(profiles);
  }, [profiles]);

  useEffect(() => {
    setTotal(initialTotal);
  }, [initialTotal]);

  useEffect(() => {
    setPockets(initialPockets);
  }, [initialPockets]);

  const resetPocketForm = useCallback((pocket: Pocket | null) => {
    if (pocket) {
      setPocketForm({
        name: pocket.name,
        color: pocket.color ?? "#0ea5e9",
        monthlyBudget: pocket.monthlyBudget > 0 ? String(pocket.monthlyBudget) : "",
        goalAmount: pocket.goalAmount > 0 ? String(pocket.goalAmount) : "",
      });
    } else {
      setPocketForm({ name: "", color: "#0ea5e9", monthlyBudget: "", goalAmount: "" });
    }
  }, []);

  const handleCreatePocket = useCallback(() => {
    resetPocketForm(null);
    setEditingPocket(null);
    setPocketError(null);
    setEditorOpen(true);
  }, [resetPocketForm]);

  const handleEditPocket = useCallback(
    (pocket: Pocket) => {
      resetPocketForm(pocket);
      setEditingPocket(pocket);
      setPocketError(null);
      setEditorOpen(true);
    },
    [resetPocketForm],
  );

  const handleViewPocket = useCallback(
    (pocket: Pocket) => {
      setInsightPocketId(pocket.id);
      setInsightOpen(true);
    },
    [],
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ pocketId?: string }>;
      const pocketId = custom.detail?.pocketId;
      if (!pocketId) return;
      const target = pockets.find((entry) => entry.id === pocketId);
      if (target) {
        handleViewPocket(target);
      }
    };
    window.addEventListener("open-pocket-insight", handler as EventListener);
    return () => {
      window.removeEventListener("open-pocket-insight", handler as EventListener);
    };
  }, [handleViewPocket, pockets]);

  const handlePocketInputChange = useCallback((field: keyof typeof pocketForm, value: string) => {
    setPocketForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }, []);

  const handleSubmitPocket = useCallback(() => {
    const currentEditing = editingPocket;
    const name = pocketForm.name.trim();
    if (!name) {
      setPocketError("Nama pocket wajib diisi.");
      return;
    }

    const monthlyBudgetValue = Number.parseInt(pocketForm.monthlyBudget.replace(/[^0-9-]/g, ""), 10);
    const goalAmountValue = Number.parseInt(pocketForm.goalAmount.replace(/[^0-9-]/g, ""), 10);

    startPocketMutation(async () => {
      const result = await upsertPocket({
        id: currentEditing?.id,
        name,
        icon: currentEditing?.icon ?? undefined,
        color: pocketForm.color,
        monthlyBudget: Number.isFinite(monthlyBudgetValue) && monthlyBudgetValue > 0 ? monthlyBudgetValue : 0,
        goalAmount: Number.isFinite(goalAmountValue) && goalAmountValue > 0 ? goalAmountValue : 0,
        order: currentEditing?.order,
        isActive: currentEditing?.isActive ?? true,
      });

      if (!result.success) {
        setPocketError(result.error);
        return;
      }

      const nextPocket = result.data;
      setPockets((prev) => {
        const updated = currentEditing
          ? prev.map((item) => (item.id === nextPocket.id ? { ...item, ...nextPocket } : item))
          : [...prev, nextPocket];
        return updated.sort((a, b) => a.order - b.order);
      });
      setPocketError(null);
      setEditorOpen(false);
      setEditingPocket(null);
      showNotification({
        type: "success",
        message: currentEditing ? "Pocket berhasil diperbarui." : "Pocket baru ditambahkan.",
      });
    });
  }, [editingPocket, pocketForm, showNotification, startPocketMutation]);

  const handleRequestDelete = useCallback((pocket: Pocket) => {
    setDeleteTarget(pocket);
    setDeleteError(null);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    const target = deleteTarget;
    if (!target) return;

    const snapshot = pockets.find((item) => item.id === target.id) ?? target;

    startPocketMutation(async () => {
      const result = await deletePocket(target.id);
      if (!result.success) {
        setDeleteError(result.error);
        showNotification({ type: "error", message: result.error });
        return;
      }

      setPockets((prev) => prev.filter((item) => item.id !== target.id));
      if (snapshot) {
        setTotal((prev) => prev - snapshot.balance);
      }
      if (editingPocket?.id === target.id) {
        setEditorOpen(false);
        setEditingPocket(null);
      }
      setDeleteTarget(null);
      setDeleteError(null);
      showNotification({ type: "success", message: `Pocket "${target.name}" dihapus.` });
    });
  }, [deleteTarget, editingPocket, pockets, showNotification, startPocketMutation]);

  const pocketOptions = useMemo(
    () => pockets.map(({ id, name }) => ({ id, name })),
    [pockets],
  );

  const pocketInsightOptions = useMemo(
    () => pockets.map(({ id, name, color, balance }) => ({ id, name, color, balance })),
    [pockets],
  );

  const handleProfileChanged = useCallback((profile: ProfileInfo) => {
    setActiveProfileState(profile);
  }, []);

  const handleProfileCreated = useCallback((profile: ProfileInfo) => {
    setProfileList((previous) => {
      if (previous.some((item) => item.id === profile.id)) {
        return previous;
      }
      return [...previous, profile];
    });
  }, []);

  const handleOptimisticCreate = (input: TxnCreateInput) => {
    const delta = input.type === "income" ? input.amount : -input.amount;
    setLastOptimistic({ pocketId: input.pocketId, delta });
    setTotal((prev) => prev + delta);
    setPockets((prev) =>
      prev.map((pocket) =>
        pocket.id === input.pocketId
          ? {
              ...pocket,
              balance: pocket.balance + delta,
            }
          : pocket,
      ),
    );
  };

  const handleInsightOptimisticUpdate = useCallback(
    ({ pocketId, delta }: { pocketId: string; delta: number }) => {
      if (!delta) return;
      setPockets((prev) =>
        prev.map((pocket) =>
          pocket.id === pocketId ? { ...pocket, balance: pocket.balance + delta } : pocket,
        ),
      );
      setTotal((prev) => prev + delta);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  const handleSettled = (result: CreateTransactionResult, payload?: TxnCreateInput) => {
    if (result.success) {
      const { pocket, total: newTotal } = result.data;
      setTotal(newTotal);
      setPockets((prev) =>
        prev.map((item) => (item.id === pocket.id ? { ...item, balance: pocket.balance } : item)),
      );
    } else {
      const fallback =
        lastOptimistic ??
        (payload
          ? {
              pocketId: payload.pocketId,
              delta: payload.type === "income" ? payload.amount : -payload.amount,
            }
          : null);
      if (fallback) {
        setTotal((prev) => prev - fallback.delta);
        setPockets((prev) =>
          prev.map((pocket) =>
            pocket.id === fallback.pocketId ? { ...pocket, balance: pocket.balance - fallback.delta } : pocket,
          ),
        );
      }
    }
    setLastOptimistic(null);
  };

  const handleOptimisticTransfer = useCallback(
    (input: TransferOptimisticPayload) => {
      const { fromId, toId, amount } = input;
      setPockets((prev) =>
        prev.map((pocket) => {
          if (pocket.id === fromId) {
            return { ...pocket, balance: pocket.balance - amount };
          }
          if (pocket.id === toId) {
            return { ...pocket, balance: pocket.balance + amount };
          }
          return pocket;
        }),
      );
      setLastTransferOptimistic({ fromId, toId, amount });
    },
    [],
  );

  const handleTransferSettled = useCallback(
    (
      result: TransferActionResult,
      context: TransferOptimisticPayload,
    ) => {
      if (result.success) {
        const { fromPocket, toPocket, total: newTotal } = result.data;
        setTotal(newTotal);
        setPockets((prev) =>
          prev.map((pocket) => {
            if (pocket.id === fromPocket.id) {
              return { ...pocket, balance: fromPocket.balance };
            }
            if (pocket.id === toPocket.id) {
              return { ...pocket, balance: toPocket.balance };
            }
            return pocket;
          }),
        );
      } else {
        const fallback = lastTransferOptimistic ?? context;
        setPockets((prev) =>
          prev.map((pocket) => {
            if (pocket.id === fallback?.fromId) {
              return { ...pocket, balance: pocket.balance + (fallback?.amount ?? 0) };
            }
            if (pocket.id === fallback?.toId) {
              return { ...pocket, balance: pocket.balance - (fallback?.amount ?? 0) };
            }
            return pocket;
          }),
        );
      }
      setLastTransferOptimistic(null);
    },
    [lastTransferOptimistic],
  );

  const currentOrderIds = useMemo(() => pockets.map((pocket) => pocket.id), [pockets]);

  const updateOrderLocally = useCallback(
    (idsInNewOrder: string[]) => {
      const map = new Map(pockets.map((pocket) => [pocket.id, pocket]));
      const seen = new Set<string>();
      const reordered = idsInNewOrder
        .map((id, index) => {
          const pocket = map.get(id);
          if (!pocket) return null;
          seen.add(id);
          return { ...pocket, order: index + 1 };
        })
        .filter((value): value is Pocket => Boolean(value));
      for (const pocket of pockets) {
        if (!seen.has(pocket.id)) {
          reordered.push(pocket);
        }
      }
      setPockets(reordered);
    },
    [pockets],
  );

  const handleReorder = useCallback(
    async (idsInNewOrder: string[]) => {
      if (idsInNewOrder.length === 0) return;
      if (idsInNewOrder.join("|") === currentOrderIds.join("|")) return;

      const previous = pockets;
      updateOrderLocally(idsInNewOrder);

      const result = await reorderPockets({ idsInNewOrder });
      if (!result.success) {
        setPockets(previous);
        showNotification({ type: "error", message: result.error });
      } else {
        setPockets((prev) => {
          const lookup = new Map(prev.map((pocket) => [pocket.id, pocket]));
          const ordered = idsInNewOrder
            .map((id, index) => {
              const pocket = lookup.get(id);
              if (!pocket) return null;
              return { ...pocket, order: index + 1 };
            })
            .filter((value): value is Pocket => Boolean(value));
          const remaining = prev.filter((item) => !idsInNewOrder.includes(item.id));
          return [...ordered, ...remaining];
        });
      }
    },
    [currentOrderIds, pockets, showNotification, updateOrderLocally],
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-16">
      {notification ? (
        <div
          role="status"
          className={cn(
            "fixed right-6 top-6 z-40 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur",
            notification.type === "success"
              ? "border-emerald-300/50 bg-emerald-100/80 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-900/60 dark:text-emerald-100"
              : "border-red-300/60 bg-red-100/80 text-red-900 dark:border-red-500/40 dark:bg-red-900/60 dark:text-red-100",
          )}
        >
          {notification.message}
        </div>
      ) : null}

      <Card className="relative overflow-hidden rounded-3xl border border-white/40 bg-white/70 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-white/10">
        <div className="absolute inset-0 -z-10 opacity-60 blur-3xl">
          <div className="mx-auto h-56 w-56 rounded-full bg-cyan-400/30 dark:bg-cyan-500/20" />
        </div>

        <CardContent className="relative flex flex-col gap-8 p-8">
          <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/50 bg-white/60 p-2 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/10">
                <Image src="/logo-g.svg" alt="Logo G-Finance" fill sizes="48px" className="object-contain" priority />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">G-Finance</h1>
                <p className="text-sm text-slate-500 dark:text-slate-300">Kelola dompet dan transaksi harian tanpa ribet.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <ProfileSwitcher
                activeProfile={activeProfileState}
                profiles={profileList}
                onProfileChange={handleProfileChanged}
                onProfileCreated={handleProfileCreated}
                onFeedback={showNotification}
              />
              <SyncStatusBadge />
              <OnlineBadge />
              <Link
                href="/assistant"
                className="group inline-flex h-10 items-center gap-2 rounded-full border border-transparent bg-gradient-to-r from-indigo-500/90 to-cyan-500/90 px-4 text-sm font-semibold text-white shadow-sm transition duration-200 ease-out hover:from-indigo-500 hover:to-cyan-500 hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:from-indigo-500/80 dark:to-cyan-500/80"
              >
                {t("assistant.link", "Assistant")}
              </Link>
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </header>

          <div className="grid gap-6 md:grid-cols-[1fr,auto] md:items-end">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">
                {t("dashboard.totalBalance", "Total Saldo")}
              </p>
              <p className="mt-2 text-5xl font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(total)}
              </p>
              <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/50 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200">
                {t("dashboard.profile", "Profil")}: {activeProfileState.name}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              <QuickAddTransactionDialog
                pockets={pocketOptions}
                onOptimisticCreate={handleOptimisticCreate}
                onSettled={handleSettled}
                onQueued={() =>
                  showNotification({
                    type: "success",
                    message: "Offline – transaksi tersimpan dan akan tersinkron otomatis.",
                  })
                }
              />
              <TransferDialog
                pockets={pocketOptions}
                onOptimisticTransfer={handleOptimisticTransfer}
                onSettled={handleTransferSettled}
                onFeedback={showNotification}
              />
              <Button
                variant="outline"
                className="group h-11 rounded-2xl border border-transparent bg-gradient-to-r from-emerald-500/90 to-teal-500/90 text-sm font-semibold text-white shadow-sm transition duration-200 ease-out hover:from-emerald-500 hover:to-teal-500 hover:shadow-lg hover:-translate-y-0.5 focus-visible:ring-offset-2 dark:from-emerald-500/80 dark:to-teal-500/80"
                type="button"
                onClick={handleCreatePocket}
                disabled={isPocketMutating}
              >
                <Plus className="h-4 w-4" />
                {t("dashboard.addPocket", "Tambah Pocket")}
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>

      <PocketGrid
        pockets={pockets}
        onReorder={handleReorder}
        onEdit={handleEditPocket}
        onDelete={handleRequestDelete}
        onView={handleViewPocket}
      />

      <section
        aria-label={t("dashboard.featureSection", "Fitur lanjutan")}
        className="grid gap-3 rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur md:grid-cols-2 dark:border-white/5 dark:bg-white/10"
      >
        <FeatureLink
          href="/transactions/import"
          icon={<UploadCloud className="h-4 w-4" />}
          title={t("feature.import.title", "Impor CSV")}
          description={t("feature.import.description", "Tarik mutasi bank, auto-kategori, dan review sebelum commit.")}
        />
        <FeatureLink
          href="/recurring"
          icon={<Repeat className="h-4 w-4" />}
          title={t("feature.recurring.title", "Recurring")}
          description={t("feature.recurring.description", "Atur jadwal mingguan/bulanan dan jalankan kapan saja.")}
        />
        <FeatureLink
          href="/settings/security"
          icon={<ShieldCheck className="h-4 w-4" />}
          title={t("feature.security.title", "PIN & Passkey")}
          description={t("feature.security.description", "Aktifkan PIN lock dan login cepat dengan passkey.")}
        />
        <FeatureLink
          href="/settings/backup"
          icon={<HardDriveDownload className="h-4 w-4" />}
          title={t("feature.backup.title", "Backup Terenkripsi")}
          description={t("feature.backup.description", "Ekspor & restore data dengan proteksi AES-GCM.")}
        />
        <FeatureLink
          href="/reports"
          icon={<FileText className="h-4 w-4" />}
          title={t("feature.reports.title", "Laporan Keuangan")}
          description={t("feature.reports.description", "Unduh ringkasan CSV atau PDF untuk periode tertentu.")}
        />
        <FeatureLink
          href="/calendar"
          icon={<CalendarClock className="h-4 w-4" />}
          title={t("feature.calendar.title", "Kalender Cashflow")}
          description={t("feature.calendar.description", "Lihat agenda recurring, payday, dan pengeluaran besar dalam satu kalender.")}
        />
      </section>

      {children ? <div className="grid gap-6 lg:auto-rows-fr lg:grid-cols-2">{children}</div> : null}

      {recentTransactions ? (
        <section className="rounded-3xl border border-slate-200/60 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/5 dark:bg-white/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">
                {t("transactions.sectionTitle", "Riwayat Transaksi")}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {t(
                  "transactions.sectionSubtitle",
                  "Tampilkan daftar transaksi hanya saat dibutuhkan untuk menjaga dashboard tetap ringkas.",
                )}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowTransactions((prev) => !prev)}
              aria-expanded={showTransactions}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border-white/40 bg-white/80 px-4 text-sm font-medium text-slate-700 backdrop-blur transition hover:bg-white/90 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <History className="h-4 w-4" />
              {showTransactions ? t("transactions.hide", "Sembunyikan Riwayat") : t("transactions.show", "Lihat Riwayat")}
              <ChevronDown
                className={cn("h-4 w-4 transition-transform duration-200", showTransactions ? "rotate-180" : "")}
              />
            </Button>
          </div>
          {showTransactions ? <div className="mt-4">{recentTransactions}</div> : null}
        </section>
      ) : null}

      <Dialog
        open={insightOpen}
        onOpenChange={(open) => {
          setInsightOpen(open);
          if (!open) {
            setInsightPocketId(null);
          }
        }}
      >
        <DialogContent className="top-auto bottom-0 left-1/2 flex h-[92vh] w-full max-w-none translate-x-[-50%] translate-y-0 overflow-hidden border border-white/40 bg-white/80 p-0 backdrop-blur [&>button:last-of-type]:hidden rounded-t-3xl sm:top-1/2 sm:bottom-auto sm:h-[85vh] sm:max-h-[85vh] sm:max-w-6xl sm:translate-y-[-50%] sm:rounded-3xl dark:border-white/10 dark:bg-slate-950/90">
          {insightPocketId ? (
            <PocketInsight
              pocketId={insightPocketId}
              pockets={pocketInsightOptions}
              onClose={() => setInsightOpen(false)}
              onOptimisticUpdate={handleInsightOptimisticUpdate}
              onRefreshRequested={() => router.refresh()}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (isPocketMutating) return;
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="w-full max-w-md rounded-3xl border border-rose-200/70 bg-white/90 p-6 backdrop-blur dark:border-rose-500/40 dark:bg-slate-950/90">
          <DialogHeader className="flex flex-row items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                Hapus pocket ini?
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600 dark:text-slate-300">
                Tindakan ini akan menghapus pocket{" "}
                <span className="font-semibold text-rose-600 dark:text-rose-300">
                  “{deleteTarget?.name ?? ""}”
                </span>{" "}
                beserta seluruh transaksi di dalamnya. Proses ini tidak dapat dibatalkan.
              </DialogDescription>
            </div>
          </DialogHeader>
          {deleteError ? (
            <p className="rounded-2xl border border-rose-300/60 bg-rose-100/80 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
              {deleteError}
            </p>
          ) : null}
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (isPocketMutating) return;
                setDeleteTarget(null);
                setDeleteError(null);
              }}
              className="rounded-2xl px-4"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isPocketMutating || !deleteTarget}
              className="rounded-2xl px-4"
            >
              {isPocketMutating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Hapus Pocket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setPocketError(null);
            setEditingPocket(null);
          }
        }}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editingPocket ? "Edit Pocket" : "Tambah Pocket"}</DialogTitle>
            <DialogDescription>
              {editingPocket ? "Perbarui detail pocket agar sesuai kebutuhan." : "Buat pocket baru untuk mengelola saldo terpisah."}
            </DialogDescription>
          </DialogHeader>
          <form
            id="pocket-editor-form"
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmitPocket();
            }}
          >
            <label className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
              Nama Pocket
              <Input
                value={pocketForm.name}
                onChange={(event) => handlePocketInputChange("name", event.target.value)}
                placeholder="Tabungan Harian"
                autoFocus
                disabled={isPocketMutating}
                required
              />
            </label>
            <label className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
              Warna (opsional)
              <Input
                type="color"
                value={pocketForm.color}
                onChange={(event) => handlePocketInputChange("color", event.target.value)}
                disabled={isPocketMutating}
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
                Anggaran Bulanan
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="cth. 2000000"
                  value={pocketForm.monthlyBudget}
                  onChange={(event) => handlePocketInputChange("monthlyBudget", event.target.value)}
                  disabled={isPocketMutating}
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
                Target Saldo
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="cth. 5000000"
                  value={pocketForm.goalAmount}
                  onChange={(event) => handlePocketInputChange("goalAmount", event.target.value)}
                  disabled={isPocketMutating}
                />
              </label>
            </div>
          </form>
          {pocketError ? <p className="text-sm text-rose-500 dark:text-rose-300">{pocketError}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditorOpen(false);
                setPocketError(null);
                setEditingPocket(null);
              }}
              disabled={isPocketMutating}
            >
              Batal
            </Button>
            <Button type="submit" form="pocket-editor-form" disabled={isPocketMutating}>
              {isPocketMutating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface FeatureLinkProps {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}

function FeatureLink({ href, icon, title, description }: FeatureLinkProps) {
  return (
    <Link
      href={href}
      className="group flex gap-3 rounded-xl border border-slate-200 bg-white/80 p-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md dark:border-white/5 dark:bg-white/10 dark:hover:border-cyan-500/50"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-slate-800 transition group-hover:text-cyan-700 dark:text-slate-100 dark:group-hover:text-cyan-300">
          {title}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-300">{description}</span>
      </span>
    </Link>
  );
}
