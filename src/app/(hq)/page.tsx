import { connection } from "next/server";
import { AddItem } from "@/components/add-item";
import { AppFrame } from "@/components/app-frame";
import { DoneGrid } from "@/components/done-grid";
import { ItemGroup, pickerProjects } from "@/components/items";
import { requireSignedIn } from "@/components/signed-in";
import { todayIn } from "@/lib/dates";
import { listDone, listItems } from "@/lib/items/data";
import { todayGroups } from "@/lib/items/views";
import { currentTimeZone, hoursAgo } from "@/lib/time-zone";

// Spec P14 and the Nov 2 rule: overdue, today, the next 7 days, later, and open items with no
// date. Items waiting on other items, items in archived projects and ideas with no date stay
// out. A brand-new account sees the first-run screen instead (spec P3).
// Above them, the done-work grid for the last year (spec 3.4).
export default async function Home() {
  // Render per request so each page gets its own CSP nonce (security rule S1).
  await connection();
  await requireSignedIn();

  const zone = await currentTimeZone();
  const today = todayIn(zone);
  const since = hoursAgo(26);
  const [open, recent, projects, year] = await Promise.all([
    listItems({ open: true }),
    listItems({ doneSince: since }),
    pickerProjects(),
    listDone(hoursAgo(54 * 7 * 24)),
  ]);
  const doneToday = (recent.ok ? recent.value : []).filter((i) => i.done_at && todayIn(zone, new Date(i.done_at)) === today);

  if (open.ok && open.value.length === 0 && doneToday.length === 0 && projects.length === 0) {
    const anything = await listItems();
    if (anything.ok && anything.value.length === 0) return <FirstRun />;
  }

  const groups = todayGroups(open.ok ? open.value : [], today);
  const date = new Date(`${today}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <AppFrame current="/">
      <div className="page-head">
        <h1>Today</h1>
        <span className="when">{date}</span>
      </div>
      <DoneGrid doneAts={year.ok ? year.value.map((d) => d.done_at) : []} timeZone={zone} today={today} weeks={53} span="the last year" />
      <AddItem projects={projects} />
      {!open.ok && (
        <p role="alert" className="alert">
          Couldn&apos;t load your items. Try again in a moment.
        </p>
      )}
      <ItemGroup title="Overdue" items={groups.overdue} today={today} tone="overdue" />
      <ItemGroup title="Today" items={groups.today} today={today} empty="Nothing left for today." />
      <ItemGroup title="Next 7 days" items={groups.week} today={today} />
      <ItemGroup title="Later" items={groups.later} today={today} />
      <ItemGroup title="No date" items={groups.undated} today={today} />
      <ItemGroup title="Done today" items={doneToday} today={today} />
    </AppFrame>
  );
}

function FirstRun() {
  return (
    <AppFrame current="/">
      <div className="page-head">
        <h1>Welcome to Founder HQ</h1>
      </div>
      <p className="lede">You have no projects or items yet.</p>
      <h2 id="next-steps">Next steps</h2>
      <ol className="steps" aria-labelledby="next-steps">
        <li>Add a project: something you are building.</li>
        <li>Connect GitHub if the project has a repo, so its activity fills in by itself.</li>
        <li>Add your first item: a to-do, reminder, idea or feature.</li>
      </ol>
    </AppFrame>
  );
}
