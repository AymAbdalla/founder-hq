import { NextResponse, type NextRequest } from "next/server";
import { buildContentSecurityPolicy, createNonce } from "@/lib/security/csp";
import { logEvent } from "@/lib/log";
import { isForgedWrite } from "@/lib/security/same-origin";

export function proxy(request: NextRequest) {
  if (isForgedWrite(request.method, request.headers, request.nextUrl.origin)) {
    logEvent("request_refused", { reason: "cross_site_write", method: request.method, path: request.nextUrl.pathname });
    return NextResponse.json({ error: "Request refused: it did not come from Founder HQ." }, { status: 403 });
  }

  const nonce = createNonce();
  const csp = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === "development");

  // Next.js reads the nonce from the request's CSP header and adds it to its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Every route, API routes included, except built static files.
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
