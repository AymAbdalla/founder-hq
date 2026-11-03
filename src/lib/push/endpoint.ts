// Push sign-ups name an address that HQ's server will later send to. Only the real push
// services are accepted, so nobody can make HQ's server post to any other address.
const PUSH_HOSTS = ["fcm.googleapis.com", "android.googleapis.com", "web.push.apple.com", "updates.push.services.mozilla.com", "push.services.mozilla.com"];
const PUSH_HOST_SUFFIXES = [".notify.windows.com", ".push.apple.com"];

export function isAllowedPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1000) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.includes(host) || PUSH_HOST_SUFFIXES.some((s) => host.endsWith(s));
}

// The two keys a browser gives with its sign-up, in base64url.
const B64URL = /^[A-Za-z0-9_-]+$/;
export function isPushKey(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max && B64URL.test(value);
}
