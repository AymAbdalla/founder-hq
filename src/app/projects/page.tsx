import { connection } from "next/server";
import { PlaceholderView, requireSignedIn } from "@/components/signed-in";

export const metadata = { title: "Projects · Founder HQ" };

export default async function ProjectsPage() {
  // Render per request so each page gets its own CSP nonce (security rule S1).
  await connection();
  await requireSignedIn();
  return (
    <PlaceholderView current="/projects" title="Projects">
      Projects arrives in step 5.
    </PlaceholderView>
  );
}
