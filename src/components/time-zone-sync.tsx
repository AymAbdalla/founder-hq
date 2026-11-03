"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Tells the server the browser's time zone through a plain cookie, then redraws the page once
// if it changed, so Today groups items by the user's own calendar.
const COOKIE = "hq-tz";

export function TimeZoneSync() {
  const router = useRouter();
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return;
    const saved = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (saved && decodeURIComponent(saved) === zone) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE}=${encodeURIComponent(zone)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    router.refresh();
  }, [router]);
  return null;
}
