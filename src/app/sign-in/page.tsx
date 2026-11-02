import { connection } from "next/server";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in · Founder HQ" };

export default async function SignInPage() {
  await connection();
  return (
    <main>
      <h1>Sign in to Founder HQ</h1>
      <p>No password needed. We email you a 6-digit code and a link; use either one.</p>
      <SignInForm />
    </main>
  );
}
