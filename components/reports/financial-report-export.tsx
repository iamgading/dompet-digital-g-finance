"use client";

import { useMemo, useState } from "react";
import { FileDown, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ReportFormat = "csv" | "pdf";

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function FinancialReportExport() {
  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() - 29);
    return date;
  }, [today]);

  const [from, setFrom] = useState<string>(formatDateInput(defaultFrom));
  const [to, setTo] = useState<string>(formatDateInput(today));
  const [error, setError] = useState<string | null>(null);
  const [busyFormat, setBusyFormat] = useState<ReportFormat | null>(null);

  const validateRange = () => {
    if (!from || !to) {
      setError("Isi rentang tanggal terlebih dahulu.");
      return null;
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      setError("Format tanggal tidak valid.");
      return null;
    }
    if (fromDate.getTime() > toDate.getTime()) {
      setError("Tanggal awal tidak boleh melebihi tanggal akhir.");
      return null;
    }
    return { fromDate, toDate };
  };

  const handleDownload = (format: ReportFormat) => {
    const range = validateRange();
    if (!range) return;

    setError(null);
    setBusyFormat(format);
    const params = new URLSearchParams({
      format,
      from,
      to,
    });
    const url = `/api/reports/financial?${params.toString()}`;
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => setBusyFormat(null), 1200);
  };

  return (
    <section className="rounded-3xl border border-white/30 bg-white/70 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-white/10">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Ekspor Laporan Keuangan</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Pilih rentang tanggal untuk mengunduh ringkasan pemasukan dan pengeluaran dalam bentuk CSV atau PDF.
          Laporan menggunakan profil aktif secara otomatis.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
          Dari tanggal
          <Input
            type="date"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
            className="h-11 rounded-2xl border border-slate-200 bg-white/70 px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
          Sampai tanggal
          <Input
            type="date"
            value={to}
            min={from}
            max={formatDateInput(today)}
            onChange={(event) => setTo(event.target.value)}
            className="h-11 rounded-2xl border border-slate-200 bg-white/70 px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
        </label>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => handleDownload("csv")}
          disabled={busyFormat !== null}
          className={cn(
            "h-11 rounded-2xl border border-transparent bg-cyan-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-wait disabled:opacity-70",
          )}
        >
          <FileDown className="mr-2 h-4 w-4" />
          {busyFormat === "csv" ? "Menyiapkan..." : "Unduh CSV"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleDownload("pdf")}
          disabled={busyFormat !== null}
          className={cn(
            "h-11 rounded-2xl border border-slate-300 bg-white/80 px-5 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-wait disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-slate-200",
          )}
        >
          <FileText className="mr-2 h-4 w-4" />
          {busyFormat === "pdf" ? "Menyiapkan..." : "Unduh PDF"}
        </Button>
      </div>
    </section>
  );
}
