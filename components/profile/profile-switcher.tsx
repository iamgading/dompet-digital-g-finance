"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createProfile, setActiveProfile } from "@/app/actions/profile";
import type { ProfileInfo } from "@/lib/types/profile";
import { useUserPref } from "@/components/providers/user-pref-provider";

interface ProfileSwitcherProps {
  activeProfile: ProfileInfo;
  profiles: ProfileInfo[];
  onProfileChange?: (profile: ProfileInfo) => void;
  onProfileCreated?: (profile: ProfileInfo) => void;
  onFeedback?: (feedback: { type: "success" | "error"; message: string }) => void;
}

export function ProfileSwitcher({
  activeProfile,
  profiles,
  onProfileChange,
  onProfileCreated,
  onFeedback,
}: ProfileSwitcherProps) {
  const router = useRouter();
  const { setPref } = useUserPref();
  const [isSwitching, startSwitchTransition] = useTransition();
  const [isCreating, startCreateTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [copyFromActive, setCopyFromActive] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const sortedProfiles = useMemo(() => {
    return [...profiles].sort((a, b) => a.name.localeCompare(b.name));
  }, [profiles]);

  const handleSwitch = (profile: ProfileInfo) => {
    if (profile.id === activeProfile.id) return;

    startSwitchTransition(async () => {
      const result = await setActiveProfile(profile.id);
      if (!result.success) {
        onFeedback?.({ type: "error", message: result.error });
        return;
      }

      const updated: ProfileInfo = {
        id: result.data.id,
        name: result.data.name,
        desc: result.data.desc ?? null,
      };

      setPref({ activeProfileId: updated.id });
      onProfileChange?.(updated);
      onFeedback?.({ type: "success", message: `Profil aktif diubah ke "${updated.name}".` });
      router.refresh();
    });
  };

  const resetForm = () => {
    setName("");
    setDesc("");
    setCopyFromActive(false);
    setFormError(null);
  };

  const handleCreate = () => {
    if (!name.trim()) {
      setFormError("Nama profil wajib diisi.");
      return;
    }

    startCreateTransition(async () => {
      const createResult = await createProfile({
        name: name.trim(),
        desc: desc.trim() ? desc.trim() : undefined,
        copyFromActive,
      });

      if (!createResult.success) {
        setFormError(createResult.error);
        return;
      }

      const createdProfile: ProfileInfo = {
        id: createResult.data.id,
        name: createResult.data.name,
        desc: createResult.data.desc ?? null,
      };

      const setResult = await setActiveProfile(createdProfile.id);
      if (!setResult.success) {
        setFormError(setResult.error);
        return;
      }

      const resolvedActive: ProfileInfo = {
        id: setResult.data.id,
        name: setResult.data.name,
        desc: setResult.data.desc ?? null,
      };

      onProfileCreated?.(createdProfile);
      setPref({ activeProfileId: resolvedActive.id });
      onProfileChange?.(resolvedActive);
      onFeedback?.({ type: "success", message: `Profil "${resolvedActive.name}" dibuat dan dipilih.` });
      resetForm();
      setDialogOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "relative inline-flex items-center gap-2 rounded-full border border-cyan-400/60 bg-white/60 px-4 py-2 text-sm font-semibold text-cyan-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-cyan-400 hover:bg-white/80 hover:text-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-cyan-500/40 dark:bg-white/10 dark:text-cyan-200 dark:hover:bg-white/20",
              (isSwitching || isCreating) && "opacity-80",
            )}
            disabled={isSwitching || isCreating}
          >
            <span className="inline-flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-500" aria-hidden />
              <span className="max-w-[140px] truncate">{activeProfile.name}</span>
            </span>
            <svg
              className="h-4 w-4 text-cyan-600 dark:text-cyan-200"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.954l3.71-3.724a.75.75 0 1 1 1.08 1.04l-4.24 4.26a.75.75 0 0 1-1.08 0l-4.24-4.26a.75.75 0 0 1 .02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 rounded-2xl border border-white/40 bg-white/90 p-2 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/90">
          <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
            Profil Aktif
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/60 dark:bg-white/10" />
          {sortedProfiles.map((profile) => {
            const isActive = profile.id === activeProfile.id;
            return (
              <DropdownMenuItem
                key={profile.id}
                onSelect={(event) => {
                  event.preventDefault();
                  handleSwitch(profile);
                }}
                className={cn(
                  "group flex w-full items-start gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-cyan-500/10 dark:text-slate-100 dark:hover:bg-cyan-500/20",
                  isActive && "bg-cyan-500/10 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200",
                )}
                disabled={isSwitching || isCreating}
              >
                <span className="flex h-5 w-5 items-center justify-center">
                  {isActive ? <Check className="h-4 w-4 text-cyan-600 dark:text-cyan-300" /> : null}
                </span>
                <span className="flex flex-col">
                  <span className="font-medium">{profile.name}</span>
                  {profile.desc ? (
                    <span className="text-xs text-slate-500 dark:text-slate-300">{profile.desc}</span>
                  ) : null}
                </span>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator className="bg-white/60 dark:bg-white/10" />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setDialogOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-cyan-600 hover:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
            disabled={isSwitching || isCreating}
          >
            <Plus className="h-4 w-4" />
            Buat Profil Baru…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Buat Profil Baru</DialogTitle>
            <DialogDescription>
              Pisahkan dompet dan transaksi berdasarkan konteks seperti pribadi, bisnis, atau keluarga.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Nama Profil
              <Input
                className="mt-2"
                placeholder="Mis. Bisnis"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isCreating}
                autoFocus
              />
            </label>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Deskripsi (opsional)
              <textarea
                className="mt-2 min-h-[80px] w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-500/30"
                placeholder="Catatan singkat untuk profil ini"
                value={desc}
                onChange={(event) => setDesc(event.target.value)}
                disabled={isCreating}
              />
            </label>
            <label className="inline-flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border border-slate-300 text-cyan-600 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-white/20 dark:bg-white/10"
                checked={copyFromActive}
                onChange={(event) => setCopyFromActive(event.target.checked)}
                disabled={isCreating}
              />
              <span>
                Copy daftar pocket dari profil aktif sekarang.
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Transaksi tidak akan ikut dipindahkan.
                </span>
              </span>
            </label>
            {formError ? <p className="text-sm text-rose-500 dark:text-rose-300">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetForm();
                setDialogOpen(false);
              }}
              disabled={isCreating}
            >
              Batal
            </Button>
            <Button type="button" onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simpan Profil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
