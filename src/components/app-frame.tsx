import Link from "next/link";
import { signOut } from "@/app/actions";
import { Brand, Icon, type IconName } from "./icons";
import { ThemeSwitch } from "./theme-switch";

export const VIEWS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/inbox", label: "Inbox", icon: "inbox" },
  { href: "/projects", label: "Projects", icon: "projects" },
  { href: "/plans", label: "Plans", icon: "plans" },
  { href: "/everything", label: "Everything", icon: "all" },
];

function NavLinks({ current }: { current: string }) {
  return VIEWS.map((v) => (
    <Link key={v.href} href={v.href} aria-current={v.href === current ? "page" : undefined}>
      <Icon name={v.icon} />
      {v.label}
    </Link>
  ));
}

function SignOut() {
  return (
    <form action={signOut}>
      <button type="submit" className="text-btn">Sign out</button>
    </form>
  );
}

// The frame for signed-in pages. Computer: green-black side rail. Phone (760px and under):
// top bar and bottom tabs instead. CSS shows one set and hides the other.
export function AppFrame({ current, children }: { current: string; children: React.ReactNode }) {
  return (
    <div className="app">
      <aside className="rail">
        <Brand />
        <nav className="nav" aria-label="Main">
          <NavLinks current={current} />
        </nav>
        <div className="rail-foot">
          <div className="foot-actions">
            <ThemeSwitch />
            <SignOut />
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <Brand />
          <div className="foot-actions">
            <ThemeSwitch />
            <SignOut />
          </div>
        </header>
        <main className="page">{children}</main>
      </div>
      <nav className="tabbar" aria-label="Main">
        <NavLinks current={current} />
      </nav>
    </div>
  );
}
