// Reads sign-in emails from the local mail catcher (Mailpit, started by `supabase start`).
// Nothing here reaches a real inbox.
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type Summary = { ID: string; Created: string };

export function testEmail(label: string): string {
  // Unique per run, so per-address limits from earlier runs never interfere.
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

export async function countEmailsTo(address: string): Promise<number> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`);
  if (!res.ok) throw new Error(`Mail catcher search failed: ${res.status}`);
  const body = (await res.json()) as { messages_count: number };
  return body.messages_count;
}

export async function latestEmailTo(address: string, timeoutMs = 10_000): Promise<{ text: string; html: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`);
    if (res.ok) {
      const body = (await res.json()) as { messages: Summary[] };
      if (body.messages.length > 0) {
        const newest = body.messages.sort((a, b) => b.Created.localeCompare(a.Created))[0];
        const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${newest.ID}`)).json()) as { Text: string; HTML: string };
        return { text: msg.Text, html: msg.HTML };
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No email reached ${address} within ${timeoutMs} ms`);
}

export function codeFrom(email: { text: string; html: string }): string {
  const match = (email.text || email.html).match(/\b(\d{6})\b/);
  if (!match) throw new Error("No 6-digit code in the email");
  return match[1];
}

export function linkFrom(email: { html: string }): URL {
  const match = email.html.match(/href="([^"]*token_hash=[^"]*)"/);
  if (!match) throw new Error("No sign-in link in the email");
  return new URL(match[1].replace(/&amp;/g, "&"));
}
