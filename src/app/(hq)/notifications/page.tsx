import { connection } from "next/server";
import { AppFrame } from "@/components/app-frame";
import { NotificationSetup } from "@/components/notification-setup";
import { requireSignedIn } from "@/components/signed-in";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { currentTimeZone } from "@/lib/time-zone";

export const metadata = { title: "Notifications · Founder HQ" };

type TestRow = { id: string; due_at: string; sent_at: string | null; sent_count: number | null; failed_at: string | null };

function outcome(t: TestRow): string {
  if (t.failed_at) return "Couldn't be sent after 3 tries";
  if (t.sent_at) return t.sent_count === 0 ? "Nothing sent: no device has notifications turned on" : `Sent to ${t.sent_count} ${t.sent_count === 1 ? "device" : "devices"}`;
  return "Waiting";
}

// Plan slice 3: turn notifications on for a device and send a test through the every-minute
// job. Settings for reminders (time zone, hidden titles) come in slice 9.
export default async function NotificationsPage() {
  await connection();
  await requireSignedIn();
  const db = await createSupabaseServerClient();
  const timeZone = await currentTimeZone();
  const [devices, tests] = await Promise.all([
    db.from("push_subscriptions").select("id", { count: "exact", head: true }),
    db.from("test_notifications").select("id, due_at, sent_at, sent_count, failed_at").order("created_at", { ascending: false }).limit(5),
  ]);
  const deviceCount = devices.count ?? 0;
  const rows = (tests.data ?? []) as TestRow[];
  return (
    <AppFrame current="/notifications">
      <div className="page-head">
        <h1>Notifications</h1>
      </div>
      <p className="lede">
        Reminders can notify your phone and computer when they&apos;re due. Notifications are on for {deviceCount} {deviceCount === 1 ? "device" : "devices"}.
      </p>
      <NotificationSetup publicKey={process.env.VAPID_PUBLIC_KEY ?? null} />
      <section className="group" aria-label="Recent tests">
        <h2 className="group-head">
          Recent tests <span className="n">{rows.length}</span>
        </h2>
        {rows.length === 0 ? (
          <p className="empty-row">No tests yet.</p>
        ) : (
          <ul className="rows">
            {rows.map((t) => (
              <li key={t.id} className="row">
                <span className="row-main">
                  <span>
                    Due {new Date(t.due_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone })}
                  </span>
                </span>
                <span className="due">{outcome(t)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppFrame>
  );
}
