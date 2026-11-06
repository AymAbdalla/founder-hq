"use client";

import { AppLink } from "./app-link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";

// The frame lives in the signed-in layout, so it stays on screen between pages and only the
// page area changes. Which tab and project are marked comes from the address, so a tap marks
// its tab at once. A page whose place the address can't tell (an item page: Inbox or a
// project?) says so with <FrameMark>.
export const VIEWS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/inbox", label: "Inbox", icon: "inbox" },
  { href: "/projects", label: "Projects", icon: "projects" },
  { href: "/plans", label: "Plans", icon: "plans" },
  { href: "/everything", label: "Everything", icon: "all" },
];

export type RailProject = { id: string; name: string };
type Mark = { current: string; project?: string };

const MarkContext = createContext<{ mark: Mark | null; setMark: (mark: Mark | null) => void }>({ mark: null, setMark: () => {} });

export function FrameMarkProvider({ children }: { children: React.ReactNode }) {
  const [mark, setMark] = useState<Mark | null>(null);
  return <MarkContext.Provider value={{ mark, setMark }}>{children}</MarkContext.Provider>;
}

// Rendered by a page to say which tab and project it belongs to. Cleared when the page goes.
export function FrameMark({ current, project }: Mark) {
  const { setMark } = useContext(MarkContext);
  useEffect(() => {
    setMark({ current, project });
    return () => setMark(null);
  }, [current, project, setMark]);
  return null;
}

const PROJECT_PATH = /^\/projects\/([0-9a-f-]{36})(?:\/|$)/;

export function markFromPath(path: string): Mark {
  const project = PROJECT_PATH.exec(path)?.[1];
  if (path === "/") return { current: "/" };
  if (path.startsWith("/items/")) return { current: "" };
  const view = [...VIEWS.slice(1).map((v) => v.href), "/notifications"].find((href) => path === href || path.startsWith(`${href}/`));
  return { current: view ?? "", project };
}

function useMark(): Mark {
  const path = usePathname();
  const { mark } = useContext(MarkContext);
  const fromPath = markFromPath(path);
  // A page's own mark wins, but only for the address it was set on: after a tap, the new
  // address decides until the new page has said otherwise.
  return mark && path.startsWith("/items/") ? mark : fromPath;
}

export function NavLinks() {
  const { current } = useMark();
  return VIEWS.map((v) => (
    <AppLink key={v.href} href={v.href} aria-current={v.href === current ? "page" : undefined}>
      <Icon name={v.icon} />
      {v.label}
    </AppLink>
  ));
}

export function NotificationsLink() {
  const { current } = useMark();
  return (
    <AppLink href="/notifications" className="icon-btn" aria-label="Notifications" title="Notifications" aria-current={current === "/notifications" ? "page" : undefined}>
      <Icon name="bell" />
    </AppLink>
  );
}

export function RailProjects({ projects }: { projects: RailProject[] }) {
  const { project } = useMark();
  if (projects.length === 0) return null;
  return (
    <div className="rail-projects">
      <h2 aria-hidden="true">Projects</h2>
      <nav className="nav" aria-label="Your projects">
        {projects.map((p) => (
          <AppLink key={p.id} href={`/projects/${p.id}`} aria-current={p.id === project ? "page" : undefined}>
            <span className="pn">{p.name}</span>
          </AppLink>
        ))}
      </nav>
    </div>
  );
}
