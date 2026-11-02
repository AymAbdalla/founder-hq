import { connection } from "next/server";
import { PlaceholderView, requireSignedIn } from "@/components/signed-in";

export const metadata = { title: "Inbox · Founder HQ" };

export default async function InboxPage() {
  // Render per request so each page gets its own CSP nonce (security rule S1).
  await connection();
  await requireSignedIn();
  return (
    <PlaceholderView current="/inbox" title="Inbox">
      Inbox arrives with items (step 6 and 8).
    </PlaceholderView>
  );
}
