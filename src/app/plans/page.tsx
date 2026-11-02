import { connection } from "next/server";
import { PlaceholderView, requireSignedIn } from "@/components/signed-in";

export const metadata = { title: "Plans · Founder HQ" };

export default async function PlansPage() {
  // Render per request so each page gets its own CSP nonce (security rule S1).
  await connection();
  await requireSignedIn();
  return (
    <PlaceholderView current="/plans" title="Plans">
      Plans arrives with GitHub plans (step 12).
    </PlaceholderView>
  );
}
