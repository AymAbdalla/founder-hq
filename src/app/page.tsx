import { connection } from "next/server";

export default async function Home() {
  // Render per request so each page gets its own CSP nonce (security rule S1).
  await connection();

  return (
    <main>
      <h1>Founder HQ</h1>
      <p>Sign-in arrives in the next build step.</p>
    </main>
  );
}
