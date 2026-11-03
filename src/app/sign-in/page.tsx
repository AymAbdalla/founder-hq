import { connection } from "next/server";
import { Brand } from "@/components/icons";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in · Founder HQ" };

// Fixed messages only: nothing from the address bar is shown on the page.
const ERRORS: Record<string, string> = {
  github: "GitHub sign-in didn't finish. Try again, or sign in with an emailed code.",
  "github-email": "GitHub says that email address isn't verified yet. Verify it on GitHub, then try again, or sign in with an emailed code.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  const { error } = await searchParams;
  const message = error && Object.hasOwn(ERRORS, error) ? ERRORS[error] : undefined;
  return (
    <main className="auth">
      <Brand />
      <h1>Sign in to Founder HQ</h1>
      {message && <p role="alert" className="alert">{message}</p>}
      {/* A plain link, not a prefetching one: following it starts a sign-in. */}
      <p>
        <a className="btn" href="/auth/github">Continue with GitHub</a>
      </p>
      <p>Or, with no password: we email you a 6-digit code and a link; use either one.</p>
      <SignInForm />
    </main>
  );
}
