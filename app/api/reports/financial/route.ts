import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import {
  buildFinancialCsv,
  buildFinancialPdf,
  generateFinancialReportData,
} from "@/lib/reports/financial";
import { ZProfileId } from "@/lib/validators";
import { getActiveProfileId as repoGetActiveProfileId } from "@/lib/repo/profiles";

function parseDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const normalizedValue = value.includes("T") ? value : `${value}T00:00:00`;
  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Format tanggal tidak valid. Gunakan ISO date (YYYY-MM-DD).");
  }
  return parsed;
}

function formatFilenameBase(profileName: string, from: Date, to: Date) {
  const sanitize = (input: string) => input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const shortDate = (date: Date) => date.toISOString().slice(0, 10);
  return `g-finance-report-${sanitize(profileName)}-${shortDate(from)}-to-${shortDate(to)}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const format = (searchParams.get("format") ?? "csv").toLowerCase();

    if (!["csv", "pdf"].includes(format)) {
      return NextResponse.json(
        { error: "Format laporan tidak dikenali. Gunakan format=csv atau format=pdf." },
        { status: 400 },
      );
    }

    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setDate(defaultFrom.getDate() - 29);

    const from = parseDate(searchParams.get("from"), defaultFrom);
    const to = parseDate(searchParams.get("to"), today);

    let profileId = searchParams.get("profileId");
    if (!profileId || profileId.trim().length === 0) {
      profileId = await repoGetActiveProfileId();
    }

    const parsedProfileId = ZProfileId.safeParse(profileId);
    if (!parsedProfileId.success) {
      return NextResponse.json({ error: "ID profil tidak valid." }, { status: 400 });
    }

    const report = await generateFinancialReportData({
      profileId: parsedProfileId.data,
      from,
      to,
    });

    const filenameBase = formatFilenameBase(report.profile.name, report.period.from, report.period.to);

    if (format === "csv") {
      const csv = buildFinancialCsv(report);
      const body = `\uFEFF${csv}`;
      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
        },
      });
    }

    const pdfBuffer = await buildFinancialPdf(report);
    const pdfBytes = new Uint8Array(pdfBuffer);

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menghasilkan laporan.";
    console.error("[reports:financial]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
