"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Papa, { type ParseError, type ParseResult } from "papaparse";
import { useDropzone } from "react-dropzone";

import { importTransactions } from "@/app/actions/finance";
import { autoCategorize } from "@/lib/auto-categorize";
import { cn } from "@/lib/utils";
import { BackToDashboardButton } from "@/components/shared/back-to-dashboard";
import { useUserPref } from "@/components/providers/user-pref-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileSwitcherStandalone } from "@/components/profile/profile-switcher-standalone";
import type { ProfileInfo } from "@/lib/types/profile";

type Pocket = {
  id: string;
  name: string;
};

interface ImportTransactionsPageProps {
  pockets: Pocket[];
  activeProfile: ProfileInfo;
  profiles: ProfileInfo[];
}

type Stage = "upload" | "map" | "review";

type MappingState = {
  date: string;
  description: string;
  amount: string;
  pocket?: string;
  note?: string;
  reference?: string;
};

type RawRow = Record<string, unknown>;

type ReviewRow = {
  id: number;
  rowNumber: number;
  raw: RawRow;
  dateString: string;
  parsedDate: Date | null;
  description: string;
  note: string;
  amountRaw: number | null;
  effectiveAmount: number | null;
  type: "income" | "expense" | null;
  selectedPocketId?: string;
  suggestedPocketId?: string;
  suggestedPocketName?: string;
  ruleKey?: string;
  keyword?: string;
  manualPocket: boolean;
  externalRef?: string;
  errors: string[];
};

type ToastSummary =
  | null
  | {
      message: string;
      details: {
        total: number;
        created: number;
        duplicates: number;
        failures: number;
      };
    };

function autoSelectColumn(fields: string[], candidates: string[]): string {
  const lowerCandidates = candidates.map((entry) => entry.toLowerCase());
  const found = fields.find((field) => lowerCandidates.some((candidate) => field.toLowerCase().includes(candidate)));
  return found ?? "";
}

function parseIsoLikeDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const normalized = trimmed.replace(/\s+/g, " ");
  const slashMatch = normalized.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slashMatch) {
    const first = Number.parseInt(slashMatch[1], 10);
    const second = Number.parseInt(slashMatch[2], 10);
    const year = Number.parseInt(slashMatch[3], 10);
    const useDayFirst = first > 12 || second <= 12;
    const day = useDayFirst ? first : second;
    const month = useDayFirst ? second : first;
    const normalizedYear = year < 100 ? 2000 + year : year;
    const parsed = new Date(Date.UTC(normalizedYear, month - 1, day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function parseAmountCell(rawValue: unknown): number | null {
  if (rawValue == null) return null;
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) return rawValue;
  const asString = String(rawValue).trim();
  if (!asString) return null;

  const cleaned = asString.replace(/[^\d,.\-]/g, "");
  if (!cleaned) return null;

  const commaCount = (cleaned.match(/,/g) ?? []).length;
  const dotCount = (cleaned.match(/\./g) ?? []).length;

  let normalized = cleaned;
  if (commaCount > 0 && dotCount > 0) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (commaCount > 0 && dotCount === 0) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  }

  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function resolvePocketId(pockets: Pocket[], rawValue: unknown): string | undefined {
  if (rawValue == null) return undefined;
  const value = String(rawValue).trim();
  if (!value) return undefined;
  const exact = pockets.find((pocket) => pocket.id === value);
  if (exact) return exact.id;
  const lower = value.toLowerCase();
  const byName = pockets.find((pocket) => pocket.name.toLowerCase() === lower);
  return byName?.id;
}

export function ImportTransactionsPage({ pockets, activeProfile, profiles }: ImportTransactionsPageProps) {
  const { formatCurrency } = useUserPref();
  const [stage, setStage] = useState<Stage>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<Array<{ data: RawRow; rowNumber: number }>>([]);
  const [fields, setFields] = useState<string[]>([]);
  const [mapping, setMapping] = useState<MappingState>({
    date: "",
    description: "",
    amount: "",
    pocket: "",
    note: "",
    reference: "",
  });
  const [reverseSign, setReverseSign] = useState(false);
  const [defaultPocketId, setDefaultPocketId] = useState<string | undefined>(pockets[0]?.id);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [toastSummary, setToastSummary] = useState<ToastSummary>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDefaultPocketId(pockets[0]?.id);
  }, [pockets]);

  useEffect(() => {
    setStage("upload");
    setFileName(null);
    setRawRows([]);
    setFields([]);
    setMapping({
      date: "",
      description: "",
      amount: "",
      pocket: "",
      note: "",
      reference: "",
    });
    setReviewRows([]);
    setParseErrors([]);
    setToastSummary(null);
  }, [pockets]);

  useEffect(() => {
    if (!toastSummary) return;
    const timeout = setTimeout(() => setToastSummary(null), 5000);
    return () => clearTimeout(timeout);
  }, [toastSummary]);

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;

      Papa.parse<RawRow>(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        delimiter: "",
        transformHeader: (header: string) => header.trim(),
        complete: (result: ParseResult<RawRow>) => {
          const filteredRows = result.data
            .map((row: RawRow, index: number) => ({ data: row, rowNumber: index + 2 }))
            .filter((entry: { data: RawRow }) =>
              Object.values(entry.data).some((value) => value !== null && String(value ?? "").trim().length > 0),
            );

          setFileName(file.name);
          setRawRows(filteredRows);
          setFields(result.meta.fields ?? []);
          setParseErrors(result.errors ?? []);

          setMapping({
            date: autoSelectColumn(result.meta.fields ?? [], ["date", "tanggal"]),
            description: autoSelectColumn(result.meta.fields ?? [], ["description", "deskripsi", "keterangan"]),
            amount: autoSelectColumn(result.meta.fields ?? [], ["amount", "nominal", "jumlah", "debit", "credit"]),
            pocket: autoSelectColumn(result.meta.fields ?? [], ["pocket", "kategori", "category", "dompet"]),
            note: autoSelectColumn(result.meta.fields ?? [], ["note", "catatan"]),
            reference: autoSelectColumn(result.meta.fields ?? [], ["ref", "id", "trans", "no"]),
          });
          setStage("map");
        },
      });
    },
    [setRawRows],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    multiple: false,
  });

  useEffect(() => {
    if (!rawRows.length || !mapping.date || !mapping.description || !mapping.amount) {
      setReviewRows([]);
      return;
    }

    const previousMap = new Map(reviewRows.map((row) => [row.id, row]));

    const nextRows = rawRows.map((entry, index) => {
      const rowId = index;
      const raw = entry.data;
      const dateValue = mapping.date ? raw[mapping.date] ?? "" : "";
      const descriptionValue = mapping.description ? raw[mapping.description] ?? "" : "";
      const amountValue = mapping.amount ? raw[mapping.amount] ?? "" : "";
      const noteValue = mapping.note ? raw[mapping.note] ?? "" : "";
      const referenceValue = mapping.reference ? raw[mapping.reference] ?? "" : "";
      const pocketValue = mapping.pocket ? raw[mapping.pocket] ?? "" : "";

      const parsedDate = mapping.date ? parseIsoLikeDate(String(dateValue ?? "")) : null;
      const parsedAmount = parseAmountCell(amountValue);
      const amountWithSign = parsedAmount == null ? null : reverseSign ? -parsedAmount : parsedAmount;
      const description = String(descriptionValue ?? "").trim();
      const note = String(noteValue ?? "").trim() || description;
      const externalRef = String(referenceValue ?? "").trim() || undefined;
      const resolvedPocket = resolvePocketId(pockets, pocketValue);

      const errors: string[] = [];
      if (!parsedDate) errors.push("Tanggal tidak valid");
      if (!description) errors.push("Deskripsi kosong");
      if (amountWithSign == null || amountWithSign === 0) errors.push("Nominal tidak valid");

      const suggestion = autoCategorize(description);
      const suggestedPocketId = suggestion
        ? resolvePocketId(pockets, suggestion.pocketName) ?? resolvedPocket
        : resolvedPocket;

      const ruleKey = suggestion ? `${suggestion.pocketName.toLowerCase()}:${suggestion.keyword}` : undefined;

      const previous = previousMap.get(rowId);
      const selectedPocketId =
        previous?.manualPocket && previous.selectedPocketId
          ? previous.selectedPocketId
          : resolvedPocket ?? suggestedPocketId ?? defaultPocketId;

      if (!selectedPocketId) {
        errors.push("Pocket belum dipilih");
      }

      const type =
        amountWithSign == null
          ? null
          : amountWithSign >= 0
            ? ("income" as const)
            : ("expense" as const);

      return {
        id: rowId,
        rowNumber: entry.rowNumber,
        raw,
        dateString: String(dateValue ?? ""),
        parsedDate,
        description,
        note,
        amountRaw: parsedAmount,
        effectiveAmount: amountWithSign,
        type,
        selectedPocketId,
        suggestedPocketId,
        suggestedPocketName: suggestion?.pocketName,
        ruleKey,
        keyword: suggestion?.keyword,
        manualPocket: previous?.manualPocket ?? false,
        externalRef,
        errors,
      };
    });

    setReviewRows(nextRows);
  }, [rawRows, mapping, reverseSign, defaultPocketId, pockets]);

  const invalidRows = useMemo(() => reviewRows.filter((row) => row.errors.length > 0), [reviewRows]);
  const validRows = useMemo(() => reviewRows.filter((row) => row.errors.length === 0), [reviewRows]);

  const handlePocketChange = useCallback((rowId: number, pocketId: string) => {
    setReviewRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const nextErrors = pocketId
          ? row.errors.filter((error) => error !== "Pocket belum dipilih")
          : Array.from(new Set([...row.errors, "Pocket belum dipilih"]));
        return {
          ...row,
          selectedPocketId: pocketId || undefined,
          manualPocket: true,
          errors: nextErrors,
        };
      }),
    );
  }, []);

  const applyRuleToSimilar = useCallback((ruleKey: string | undefined, pocketId: string) => {
    if (!ruleKey) return;
    setReviewRows((prev) =>
      prev.map((row) =>
        row.ruleKey === ruleKey
          ? {
              ...row,
              selectedPocketId: pocketId,
              manualPocket: true,
              errors: row.errors.filter((error) => error !== "Pocket belum dipilih"),
            }
          : row,
      ),
    );
  }, []);

  const handleImport = useCallback(() => {
    if (!validRows.length) return;

    const payloadRows = validRows.map((row) => ({
      date: row.parsedDate ? row.parsedDate.toISOString() : "",
      description: row.description,
      amount: row.amountRaw ?? 0,
      note: row.note,
      pocketId: row.selectedPocketId,
      externalRef: row.externalRef,
    }));

    startTransition(async () => {
      const result = await importTransactions({
        rows: payloadRows,
        defaultPocketId: defaultPocketId,
        reverseSign,
      });

      if (!result.success) {
        setToastSummary({
          message: result.error,
          details: { total: payloadRows.length, created: 0, duplicates: 0, failures: payloadRows.length },
        });
        return;
      }

      setToastSummary({
        message: "Impor berhasil diproses.",
        details: {
          total: result.data.totalRows ?? payloadRows.length,
          created: result.data.created.length,
          duplicates: result.data.duplicates.length,
          failures: result.data.failures.length,
        },
      });

      setStage("review");
    });
  }, [validRows, defaultPocketId, reverseSign]);

  const resetAll = useCallback(() => {
    setStage("upload");
    setFileName(null);
    setRawRows([]);
    setFields([]);
    setMapping({
      date: "",
      description: "",
      amount: "",
      pocket: "",
      note: "",
      reference: "",
    });
    setReviewRows([]);
    setParseErrors([]);
    setReverseSign(false);
    setToastSummary(null);
  }, []);

  const previewRows = reviewRows.slice(0, 20);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Import Transaksi</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Unggah file CSV dari bank atau e-wallet, sesuaikan kolom, lalu review sebelum disimpan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ProfileSwitcherStandalone
            initialActiveProfile={activeProfile}
            initialProfiles={profiles}
          />
          <BackToDashboardButton />
        </div>
      </header>

      {toastSummary ? (
        <div
          role="status"
          className="fixed right-6 top-6 z-50 flex max-w-sm flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-100/90 p-4 text-emerald-900 shadow-lg backdrop-blur dark:border-emerald-500/40 dark:bg-emerald-900/70 dark:text-emerald-100"
        >
          <div className="text-sm font-semibold">{toastSummary.message}</div>
          <div className="text-xs text-emerald-700 dark:text-emerald-200">
            {`Total ${toastSummary.details.total} baris • Berhasil ${toastSummary.details.created} • Duplikat ${toastSummary.details.duplicates} • Gagal ${toastSummary.details.failures}`}
          </div>
          <Link
            href="/transactions"
            className="mt-1 inline-flex items-center justify-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
          >
            View in Transactions
          </Link>
        </div>
      ) : null}

      <Card className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/10">
        <CardContent className="grid gap-6 p-8">
          <div
            {...getRootProps()}
            className={cn(
              "flex h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-cyan-400/60 bg-cyan-50/40 text-center text-cyan-700 transition hover:border-cyan-500 hover:bg-cyan-50 dark:border-cyan-500/40 dark:bg-cyan-950/20 dark:text-cyan-200 dark:hover:border-cyan-300",
              stage !== "upload" && "border-transparent bg-transparent hover:border-transparent hover:bg-transparent",
            )}
          >
            <input {...getInputProps()} />
            {stage === "upload" ? (
              <>
                <p className="text-sm font-medium">
                  {isDragActive ? "Lepaskan file di sini" : "Seret & tempatkan file CSV atau klik untuk memilih"}
                </p>
                <p className="text-xs text-cyan-600/80 dark:text-cyan-200/80">Format yang didukung: .csv</p>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1 text-sm">
                <span className="font-medium text-slate-600 dark:text-slate-200">File dipilih:</span>
                <span className="text-slate-500 dark:text-slate-300">{fileName}</span>
                <Button type="button" size="sm" variant="outline" className="mt-3" onClick={resetAll}>
                  Ganti file
                </Button>
              </div>
            )}
          </div>

          {parseErrors.length > 0 ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200">
              {parseErrors.slice(0, 3).map((error, index) => (
                <p key={`${error.code}-${index}`}>
                  {error.row && error.row > 0 ? `Baris ${error.row}: ` : null}
                  {error.message}
                </p>
              ))}
            </div>
          ) : null}

          {stage !== "upload" ? (
            <section className="grid gap-6">
              <div className="grid gap-4 rounded-2xl border border-white/40 bg-white/60 p-6 dark:border-white/10 dark:bg-white/5">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Mapping Kolom</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {(["date", "description", "amount"] as const).map((field) => (
                    <label key={field} className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
                      <span className="font-medium">
                        {field === "date" ? "Tanggal" : field === "description" ? "Deskripsi" : "Nominal"}
                        <span className="ml-1 text-red-500">*</span>
                      </span>
                      <select
                        value={mapping[field]}
                        onChange={(event) =>
                          setMapping((prev) => ({
                            ...prev,
                            [field]: event.target.value,
                          }))
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <option value="">Pilih kolom...</option>
                        {fields.map((fieldName) => (
                          <option key={`${field}-${fieldName}`} value={fieldName}>
                            {fieldName || "(kolom kosong)"}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {(["pocket", "note", "reference"] as const).map((field) => (
                    <label key={field} className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
                      <span className="font-medium">
                        {field === "pocket" ? "Kolom Pocket (opsional)" : field === "note" ? "Kolom Catatan" : "Kolom Referensi"}
                      </span>
                      <select
                        value={mapping[field] ?? ""}
                        onChange={(event) =>
                          setMapping((prev) => ({
                            ...prev,
                            [field]: event.target.value,
                          }))
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <option value="">(Tidak dipakai)</option>
                        {fields.map((fieldName) => (
                          <option key={`${field}-${fieldName}`} value={fieldName}>
                            {fieldName || "(kolom kosong)"}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                      checked={reverseSign}
                      onChange={(event) => setReverseSign(event.target.checked)}
                    />
                    Balik tanda nominal (contoh: debit = expense)
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="font-medium text-slate-600 dark:text-slate-200">Default pocket:</span>
                    <select
                      value={defaultPocketId ?? ""}
                      onChange={(event) => setDefaultPocketId(event.target.value || undefined)}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <option value="">(Wajib jika tidak ada kolom pocket)</option>
                      {pockets.map((pocket) => (
                        <option key={pocket.id} value={pocket.id}>
                          {pocket.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    Preview ({previewRows.length} dari {reviewRows.length} baris)
                  </h2>
                  <div className="text-sm text-slate-500 dark:text-slate-300">
                    {invalidRows.length > 0
                      ? `${invalidRows.length} baris perlu diperbaiki sebelum review`
                      : "Semua baris valid"}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/40 bg-white/70 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700/60">
                    <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/40 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-3">Baris</th>
                        <th className="px-4 py-3">Tanggal</th>
                        <th className="px-4 py-3">Deskripsi</th>
                        <th className="px-4 py-3 text-right">Nominal</th>
                        <th className="px-4 py-3">Pocket</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/40">
                      {previewRows.map((row) => (
                        <tr key={row.id} className={row.errors.length ? "bg-red-50/40 dark:bg-red-900/20" : ""}>
                          <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">#{row.rowNumber}</td>
                          <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">
                            {row.parsedDate ? row.parsedDate.toLocaleDateString("id-ID") : row.dateString}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-100">
                            <div className="flex flex-col gap-1">
                              <span>{row.description || <span className="text-slate-400">Deskripsi kosong</span>}</span>
                              {row.keyword ? (
                                <span className="inline-flex w-fit items-center rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-200">
                                  auto • {row.keyword}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums">
                            {row.effectiveAmount != null ? (
                              <span className={row.effectiveAmount >= 0 ? "text-emerald-600" : "text-rose-500"}>
                                {formatCurrency(Math.abs(row.effectiveAmount))}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-200">
                            {row.selectedPocketId
                              ? pockets.find((pocket) => pocket.id === row.selectedPocketId)?.name ?? "-"
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-300">
                            {row.errors.length ? row.errors[0] : "Siap review"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    {invalidRows.length > 0
                      ? "Perbaiki mapping hingga semua baris valid."
                      : "Lanjutkan untuk review dan koreksi pocket per baris."}
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={resetAll}>
                      Reset
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setStage("review")}
                      disabled={
                        !mapping.date || !mapping.description || !mapping.amount || invalidRows.length > 0 || !reviewRows.length
                      }
                    >
                      Review Detail
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </CardContent>
      </Card>

      {stage === "review" ? (
        <section className="grid gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Review & Koreksi</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">
                Ubah pocket bila perlu. Gunakan tombol “Apply to all similar” untuk menerapkan saran ke baris sejenis.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => setStage("map")}>
              Kembali ke mapping
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/40 bg-white/70 shadow-sm dark:border-white/10 dark:bg-white/5">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700/70">
              <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Baris</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Deskripsi</th>
                  <th className="px-4 py-3 text-right">Nominal</th>
                  <th className="px-4 py-3">Pocket</th>
                  <th className="px-4 py-3 w-48">Aksi</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/50">
                {reviewRows.map((row) => (
                  <tr key={`review-${row.id}`} className={row.errors.length ? "bg-red-50/50 dark:bg-red-900/20" : ""}>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">#{row.rowNumber}</td>
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">
                      {row.parsedDate ? row.parsedDate.toLocaleDateString("id-ID") : row.dateString}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-100">
                      <div className="flex flex-col gap-1">
                        <span>{row.description}</span>
                        {row.keyword ? (
                          <span className="inline-flex w-fit items-center rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-200">
                            auto • {row.keyword}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {row.effectiveAmount != null ? (
                        <span className={row.effectiveAmount >= 0 ? "text-emerald-600" : "text-rose-500"}>
                          {formatCurrency(Math.abs(row.effectiveAmount))}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.selectedPocketId ?? ""}
                        onChange={(event) => handlePocketChange(row.id, event.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <option value="">Pilih pocket...</option>
                        {pockets.map((pocket) => (
                          <option key={`${row.id}-${pocket.id}`} value={pocket.id}>
                            {pocket.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {row.ruleKey && row.suggestedPocketId ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => applyRuleToSimilar(row.ruleKey, row.suggestedPocketId!)}
                        >
                          Apply to all similar
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-300">
                      {row.errors.length ? row.errors.join(", ") : "OK"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/40 bg-white/60 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-100">
                {validRows.length} siap diimpor
              </span>
              {invalidRows.length > 0 ? (
                <span className="ml-2 text-rose-500">• {invalidRows.length} baris bermasalah</span>
              ) : null}
            </div>
            <Button
              type="button"
              onClick={handleImport}
              disabled={isPending || !validRows.length || invalidRows.length > 0}
              className="min-w-[120px]"
            >
              {isPending ? "Memproses..." : "Import"}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
