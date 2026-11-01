// Security rule S4: logs never contain keys, request bodies or private repo text.
//
// Log through logEvent only, with a short event name and a few plain fields
// (method, path without query string, status, counts). Two guards back that up:
// - a field whose name suggests a secret is replaced with [redacted];
// - any value that looks like a key or token is masked.
type Field = string | number | boolean | null;

const SECRET_FIELD = /(key|token|secret|password|passwd|auth|cookie|session|signature|body|payload)/i;

const SECRET_VALUES: RegExp[] = [
  /Bearer\s+\S+/gi,
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, // JWTs
  /\b(sb_secret|sb_publishable|sk|rk|whsec)_[A-Za-z0-9_-]{8,}/g, // Supabase, Stripe-style keys
  /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g, // GitHub tokens
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /[A-Za-z0-9+/=_]{40,}/g, // any long unbroken token-like run
];

function mask(value: string): string {
  return SECRET_VALUES.reduce((text, pattern) => text.replace(pattern, "[redacted]"), value);
}

export function logEvent(event: string, fields: Record<string, Field> = {}): void {
  const safe: Record<string, Field> = {};
  for (const [name, value] of Object.entries(fields)) {
    if (SECRET_FIELD.test(name)) safe[name] = "[redacted]";
    else safe[name] = typeof value === "string" ? mask(value) : value;
  }
  console.log(JSON.stringify({ event: mask(event), ...safe }));
}
