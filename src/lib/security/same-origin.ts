// Security rule S1: every data-changing request must come from HQ itself.
//
// Browsers attach Origin and Sec-Fetch-Site to every cross-site write, and a web page
// cannot remove them. So a write is refused when either header points anywhere but HQ.
// Requests carrying neither header come from non-browser clients (GitHub's webhook,
// AI tools, the helper). They cannot ride on a user's cookies, and each of those
// routes checks its own signature or token.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isForgedWrite(method: string, headers: Headers, ownOrigin: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false;

  const site = headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") return true;

  const origin = headers.get("origin");
  if (origin !== null && origin !== ownOrigin) return true;

  return false;
}
