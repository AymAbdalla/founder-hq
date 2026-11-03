import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { logEvent } from "@/lib/log";
import { sendDueNotifications } from "@/lib/push/send";

// Called every minute by the database's scheduler (pg_cron), not by browsers. It uses no
// cookies; it needs the shared secret in CRON_SECRET, compared in constant time.
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return false;
  const given = request.headers.get("authorization") ?? "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(`Bearer ${secret}`));
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    logEvent("notify_refused", { method: "POST", path: "/api/notify", status: 401 });
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }
  try {
    const totals = await sendDueNotifications();
    logEvent("notify_run", { ...totals });
    return NextResponse.json(totals);
  } catch {
    logEvent("notify_failed", { method: "POST", path: "/api/notify", status: 500 });
    return NextResponse.json({ error: "The job failed." }, { status: 500 });
  }
}
