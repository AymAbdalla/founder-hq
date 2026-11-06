import { signOut } from "@/app/actions";
import { listProjects } from "@/lib/projects/data";
import { FrameMark, FrameMarkProvider, NavLinks, NotificationsLink, RailProjects } from "./frame-nav";
import { Brand } from "./icons";
import { ThemeSwitch } from "./theme-switch";
import { TimeZoneSync } from "./time-zone-sync";

function SignOut() {
  return (
    <form action={signOut}>
      <button type="submit" className="text-btn">Sign out</button>
    </form>
  );
}

// The frame for signed-in pages, drawn once by the signed-in layout and kept between pages.
// Computer: green-black side rail. Phone (760px and under): top bar and bottom tabs instead.
// CSS shows one set and hides the other. The rail also lists the account's active projects
// (archived ones leave it, spec P7).
export async function Frame({ children }: { children: React.ReactNode }) {
  const active = await listProjects("active");
  const projects = active.ok ? active.value.map((p) => ({ id: p.id, name: p.name })) : [];
  return (
    <FrameMarkProvider>
      <div className="app">
        <a className="skip" href="#main">
          Skip to main content
        </a>
        <aside className="rail">
          <Brand />
          <nav className="nav" aria-label="Main">
            <NavLinks />
          </nav>
          <RailProjects projects={projects} />
          <div className="rail-foot">
            <div className="foot-actions">
              <NotificationsLink />
              <ThemeSwitch />
              <SignOut />
            </div>
          </div>
        </aside>
        <div className="main">
          <header className="topbar">
            <Brand />
            <div className="foot-actions">
              <NotificationsLink />
              <ThemeSwitch />
              <SignOut />
            </div>
          </header>
          <main className="page" id="main" tabIndex={-1}>
            {children}
          </main>
        </div>
        <nav className="tabbar" aria-label="Main">
          <NavLinks />
        </nav>
        <TimeZoneSync />
      </div>
    </FrameMarkProvider>
  );
}

// A signed-in page's content. The frame around it comes from the layout; this only tells the
// frame which tab and project the page belongs to, for pages the address alone can't place.
export function AppFrame({ current, project, children }: { current: string; project?: string; children: React.ReactNode }) {
  return (
    <>
      <FrameMark current={current} project={project} />
      {children}
    </>
  );
}
