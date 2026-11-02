import { connection } from "next/server";
import { AppFrame } from "@/components/app-frame";
import { requireSignedIn } from "@/components/signed-in";

export default async function Home() {
  // Render per request so each page gets its own CSP nonce (security rule S1).
  await connection();
  await requireSignedIn();

  return (
    <AppFrame current="/">
      <div className="page-head">
        <h1>Welcome to Founder HQ</h1>
      </div>
      <p className="lede">You have no projects or items yet.</p>
      <h2 id="next-steps">Next steps</h2>
      <ol className="steps" aria-labelledby="next-steps">
        <li>Add a project: something you are building.</li>
        <li>Connect GitHub if the project has a repo, so its activity fills in by itself.</li>
        <li>Add your first item: a to-do, reminder, idea or feature.</li>
      </ol>
    </AppFrame>
  );
}
