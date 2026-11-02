import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions, supabasePublicKey, supabaseUrl } from "./config";

// Refreshes the sign-in session on each request and passes new cookies on to the page
// and the browser. `requestHeaders` carries the CSP nonce set by the proxy.
export async function refreshSession(request: NextRequest, requestHeaders: Headers): Promise<NextResponse> {
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(supabaseUrl(), supabasePublicKey(), {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        requestHeaders.set("cookie", request.cookies.toString());
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}
