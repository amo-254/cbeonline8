import { NextResponse } from "next/server";
import { runAcademicYearTransition } from "@/lib/academic-year";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const result = await runAcademicYearTransition(new Date().getFullYear());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled transition failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
