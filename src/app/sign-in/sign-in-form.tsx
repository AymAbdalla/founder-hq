"use client";

import { useActionState } from "react";
import { requestCode, verifyCode, type SignInState } from "./actions";

const start: SignInState = { step: "email", email: "", message: "" };

export function SignInForm() {
  const [emailState, sendEmail, sending] = useActionState(requestCode, start);
  const [codeState, sendCode, checking] = useActionState(verifyCode, start);

  const onCodeStep = emailState.step === "code";
  const email = codeState.email || emailState.email;

  if (!onCodeStep) {
    return (
      <form action={sendEmail}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={emailState.email} />
        <button type="submit" disabled={sending}>Email me a sign-in code</button>
        {emailState.message && <p role="alert">{emailState.message}</p>}
      </form>
    );
  }

  return (
    <>
      <form action={sendCode}>
        <p>We sent a code to {email}. Enter it below, or open the link in the email.</p>
        <input type="hidden" name="email" value={email} />
        <label htmlFor="code">6-digit code</label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" required />
        <button type="submit" disabled={checking}>Sign in</button>
        {codeState.message && <p role="alert">{codeState.message}</p>}
      </form>
      <form action={sendEmail}>
        <input type="hidden" name="email" value={email} />
        <button type="submit" disabled={sending}>Send a new code</button>
        {emailState.message && <p role="alert">{emailState.message}</p>}
      </form>
    </>
  );
}
