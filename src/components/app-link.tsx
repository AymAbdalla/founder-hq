"use client";

import Link, { useLinkStatus } from "next/link";

// An empty marker inside a link that says "this link's page is loading". CSS uses it to run
// the thin bar at the top and to mark a tapped tab at once (globals.css, "While a tapped link loads").
function LinkPending() {
  const { pending } = useLinkStatus();
  return <span className="link-pending" data-pending={pending ? "" : undefined} aria-hidden="true" />;
}

// A link inside signed-in HQ. Same as Next's Link, plus instant feedback while the next page loads.
export function AppLink({ children, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <LinkPending />
    </Link>
  );
}
