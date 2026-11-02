import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function Home() {
  // Render per request so each page gets its own CSP nonce (security rule S1).
  await connection();

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");

  return (
    <main>
      <h1>Welcome to Founder HQ</h1>
      <p>You have no projects or items yet.</p>
      <h2 id="next-steps">Next steps</h2>
      <ol aria-labelledby="next-steps">
        <li>Add a project: something you are building.</li>
        <li>Connect GitHub so repo activity fills in by itself.</li>
        <li>Add your first item: a to-do, reminder, idea or feature.</li>
      </ol>
      <form action={signOut}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
