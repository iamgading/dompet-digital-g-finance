import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";

const REPORT_FONT_PATH = path.join(process.cwd(), "lib/reports/fonts/DejaVuSans.ttf");
let reportFontCache: Buffer | null = null;

function getReportFontBuffer(): Buffer {
  if (!reportFontCache) {
    reportFontCache = fs.readFileSync(REPORT_FONT_PATH);
  }
  return reportFontCache;
}

import { getSupabaseAdminClient } from "@/lib/supabase";
import { mapTransactionRow, type TransactionRecord } from "@/lib/repo/transactions";
import { getUserPref } from "@/lib/repo/user-pref";

type NumericSummary = {
  income: number;
  expense: number;
  net: number;
};

export type FinancialReportParams = {
  profileId: string;
  from: Date;
  to: Date;
};

export type FinancialReportData = {
  profile: {
    id: string;
    name: string;
  };
  period: {
    from: Date;
    to: Date;
  };
  totals: NumericSummary;
  pocketTotals: Array<{
    pocketId: string;
    pocketName: string;
    income: number;
    expense: number;
    net: number;
  }>;
  transactions: Array<
    TransactionRecord & {
      pocketName: string;
    }
  >;
  locale: string;
  currency: string;
};

function normalizeDate(input: Date, endOfDay = false) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal laporan tidak valid.");
  }
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

export async function generateFinancialReportData(params: FinancialReportParams): Promise<FinancialReportData> {
  const from = normalizeDate(params.from, false);
  const to = normalizeDate(params.to, true);
  if (from.getTime() > to.getTime()) {
    throw new Error("Rentang tanggal laporan tidak valid.");
  }

  const supabase = getSupabaseAdminClient();
  const [profileRes, pocketRes, txnRes, userPref] = await Promise.all([
    supabase.from("Profile").select("*").eq("id", params.profileId).maybeSingle(),
    supabase.from("Pocket").select("*").eq("profileId", params.profileId),
    supabase
      .from("Transaction")
      .select("*")
      .eq("profileId", params.profileId)
      .gte("date", from.toISOString())
      .lte("date", to.toISOString())
      .order("date", { ascending: true }),
    getUserPref(),
  ]);

  if (profileRes.error) {
    throw new Error(`Gagal memuat profil laporan: ${profileRes.error.message}`);
  }

  if (!profileRes.data) {
    throw new Error("Profil yang dipilih tidak ditemukan.");
  }

  if (pocketRes.error) {
    throw new Error(`Gagal memuat data pocket: ${pocketRes.error.message}`);
  }

  if (txnRes.error) {
    throw new Error(`Gagal memuat transaksi: ${txnRes.error.message}`);
  }

  const transactions = (txnRes.data ?? []).map((row) => {
    const mapped = mapTransactionRow(row);
    const pocket = (pocketRes.data ?? []).find((p) => p.id === mapped.pocketId);
    return {
      ...mapped,
      pocketName: pocket?.name ?? "Tidak diketahui",
    };
  });

  const totals = transactions.reduce<NumericSummary>(
    (acc, txn) => {
      if (txn.type === "income") {
        acc.income += txn.amount;
      } else if (txn.type === "expense") {
        acc.expense += txn.amount;
      }
      return acc;
    },
    { income: 0, expense: 0, net: 0 },
  );
  totals.net = totals.income - totals.expense;

  const pocketTotalsMap = new Map<string, { pocketName: string; income: number; expense: number }>();
  for (const pocketRow of pocketRes.data ?? []) {
    pocketTotalsMap.set(pocketRow.id, {
      pocketName: pocketRow.name,
      income: 0,
      expense: 0,
    });
  }

  for (const txn of transactions) {
    const pocketTotal = pocketTotalsMap.get(txn.pocketId);
    if (!pocketTotal) continue;
    if (txn.type === "income") {
      pocketTotal.income += txn.amount;
    } else if (txn.type === "expense") {
      pocketTotal.expense += txn.amount;
    }
  }

  const pocketTotals = Array.from(pocketTotalsMap.entries()).map(([pocketId, value]) => ({
    pocketId,
    pocketName: value.pocketName,
    income: value.income,
    expense: value.expense,
    net: value.income - value.expense,
  }));

  const locale = userPref?.locale ?? "id-ID";
  const currency = userPref?.currency ?? "IDR";

  return {
    profile: {
      id: profileRes.data.id,
      name: profileRes.data.name,
    },
    period: { from, to },
    totals,
    pocketTotals,
    transactions,
    locale,
    currency,
  };
}

function csvEscape(value: string | number): string {
  const str = typeof value === "string" ? value : String(value);
  if (/["\n,]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCurrency(value: number, locale: string, currency: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  }).format(value);
}

export function buildFinancialCsv(report: FinancialReportData): string {
  const { profile, period, totals, pocketTotals, transactions, locale, currency } = report;
  const lines: string[] = [];

  lines.push(["Laporan Keuangan G-Finance"].map(csvEscape).join(","));
  lines.push([`Profil`, profile.name].map(csvEscape).join(","));
  lines.push(
    ["Periode", `${formatDate(period.from, locale)} - ${formatDate(period.to, locale)}`]
      .map(csvEscape)
      .join(","),
  );
  lines.push("");
  lines.push(["Ringkasan"].map(csvEscape).join(","));
  lines.push(["Total Pemasukan", formatCurrency(totals.income, locale, currency)].map(csvEscape).join(","));
  lines.push(["Total Pengeluaran", formatCurrency(totals.expense, locale, currency)].map(csvEscape).join(","));
  lines.push(["Surplus / Defisit", formatCurrency(totals.net, locale, currency)].map(csvEscape).join(","));
  lines.push("");

  if (pocketTotals.length > 0) {
    lines.push(["Ringkasan per Pocket"].map(csvEscape).join(","));
    lines.push(["Pocket", "Pemasukan", "Pengeluaran", "Netto"].map(csvEscape).join(","));
    for (const pocket of pocketTotals) {
      lines.push(
        [
          pocket.pocketName,
          formatCurrency(pocket.income, locale, currency),
          formatCurrency(pocket.expense, locale, currency),
          formatCurrency(pocket.net, locale, currency),
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    lines.push("");
  }

  lines.push(["Tanggal", "Jenis", "Pocket", "Catatan", "Nominal", "Sumber", "ID"].map(csvEscape).join(","));

  for (const txn of transactions) {
    lines.push(
      [
        formatDate(txn.date, locale),
        txn.type,
        txn.pocketName,
        txn.note ?? "",
        formatCurrency(txn.amount, locale, currency),
        txn.source ?? "",
        txn.id,
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  return lines.join("\n");
}

export async function buildFinancialPdf(report: FinancialReportData): Promise<Buffer> {
  const { profile, period, totals, pocketTotals, transactions, locale, currency } = report;
  const numberFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  });

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (error) => reject(error));

    try {
      const fontBuffer = getReportFontBuffer();
      doc.registerFont("ReportRegular", fontBuffer);
      doc.font("ReportRegular");
    } catch (fontError) {
      doc.end();
      reject(fontError instanceof Error ? fontError : new Error("Gagal memuat font laporan."));
      return;
    }

    doc.fontSize(20).text("Laporan Keuangan", { align: "left" });
    doc.moveDown(0.2);
    doc.fontSize(11).fillColor("#4b5563").text(`Profil: ${profile.name}`);
    doc.text(`Periode: ${dateFormatter.format(period.from)} - ${dateFormatter.format(period.to)}`);
    doc.moveDown();

    doc.fillColor("#111827").fontSize(13).text("Ringkasan", { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(11);
    doc.text(`Total Pemasukan: ${numberFormatter.format(totals.income)}`);
    doc.text(`Total Pengeluaran: ${numberFormatter.format(totals.expense)}`);
    doc.text(`Surplus / Defisit: ${numberFormatter.format(totals.net)}`);
    doc.moveDown();

    if (pocketTotals.length > 0) {
      doc.fontSize(13).text("Ringkasan per Pocket", { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(10);
      const columnPositions = [doc.x, doc.x + 200, doc.x + 320, doc.x + 420];
      doc.text("Pocket", columnPositions[0], doc.y);
      doc.text("Pemasukan", columnPositions[1], doc.y);
      doc.text("Pengeluaran", columnPositions[2], doc.y);
      doc.text("Netto", columnPositions[3], doc.y);
      doc.moveDown(0.2);
      doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#e5e7eb").stroke();
      doc.moveDown(0.2);

      for (const pocket of pocketTotals) {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 60) {
          doc.addPage();
        }
        doc.text(pocket.pocketName, columnPositions[0], doc.y);
        doc.text(numberFormatter.format(pocket.income), columnPositions[1], doc.y);
        doc.text(numberFormatter.format(pocket.expense), columnPositions[2], doc.y);
        doc.text(numberFormatter.format(pocket.net), columnPositions[3], doc.y);
        doc.moveDown(0.2);
      }
      doc.moveDown();
    }

    doc.fontSize(13).fillColor("#111827").text("Daftar Transaksi", { underline: true });
    doc.moveDown(0.4);

    const tableColumns = [doc.x, doc.x + 90, doc.x + 150, doc.x + 260, doc.x + 450];

    doc.fontSize(10).fillColor("#0f172a");
    doc.text("Tanggal", tableColumns[0], doc.y);
    doc.text("Jenis", tableColumns[1], doc.y);
    doc.text("Pocket", tableColumns[2], doc.y);
    doc.text("Catatan", tableColumns[3], doc.y);
    doc.text("Nominal", tableColumns[4], doc.y, { align: "right" });
    doc.moveDown(0.2);
    doc
      .moveTo(doc.x, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor("#e5e7eb")
      .stroke();
    doc.moveDown(0.2);

    doc.fontSize(9).fillColor("#1f2937");

    const ensureSpace = () => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 60) {
        doc.addPage();
        doc.fontSize(10).fillColor("#0f172a");
        doc.text("Tanggal", tableColumns[0], doc.y);
        doc.text("Jenis", tableColumns[1], doc.y);
        doc.text("Pocket", tableColumns[2], doc.y);
        doc.text("Catatan", tableColumns[3], doc.y);
        doc.text("Nominal", tableColumns[4], doc.y, { align: "right" });
        doc.moveDown(0.2);
        doc
          .moveTo(doc.x, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .strokeColor("#e5e7eb")
          .stroke();
        doc.moveDown(0.2);
        doc.fontSize(9).fillColor("#1f2937");
      }
    };

    for (const txn of transactions) {
      ensureSpace();
      const y = doc.y;
      doc.text(dateFormatter.format(txn.date), tableColumns[0], y);
      doc.text(txn.type === "income" ? "Pemasukan" : "Pengeluaran", tableColumns[1], y);
      doc.text(txn.pocketName, tableColumns[2], y, { width: 100 });
      doc.text(txn.note ?? "-", tableColumns[3], y, { width: 170 });
      doc.text(numberFormatter.format(txn.amount), tableColumns[4], y, { align: "right" });
      doc.moveDown(0.4);
    }

    if (transactions.length === 0) {
      doc.text("Tidak ada transaksi pada periode ini.");
    }

    doc.end();
  });
}
