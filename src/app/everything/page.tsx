import { connection } from "next/server";
import { PlaceholderView, requireSignedIn } from "@/components/signed-in";

export const metadata = { title: "Everything · Founder HQ" };

export default async function EverythingPage() {
  // Render per request so each page gets its own CSP nonce (security rule S1).
  await connection();
  await requireSignedIn();
  return (
    <PlaceholderView current="/everything" title="Everything">
      Everything arrives in step 8, with search and filters over all your items.
    </PlaceholderView>
  );
}
