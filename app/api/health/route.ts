import { NextResponse } from "next/server";

import { dbHealth } from "@/app/actions/health";

export async function GET() {
  const result = await dbHealth();

  const status = result.ok ? 200 : 503;

  return NextResponse.json(
    result.ok
      ? { ok: true }
      : { ok: false, error: result.error ?? "Database connection failed" },
    { status },
  );
}
