import { doneByDay, level, monthTotals, yearGrid, type Day } from "@/lib/activity";
import { HeatScroll } from "./heat-scroll";

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function dayName(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

// Spec 3.4, done-work grid: one square per day, shaded by how many items were ticked done that
// day, today marked, the total above, and the same numbers as a table (spec P20: charts have a
// text version). Colour is never the only carrier: the total and the table say it in words.
export function DoneGrid({ doneAts, timeZone, today, weeks, span }: { doneAts: string[]; timeZone: string; today: string; weeks: number; span: string }) {
  const grid = yearGrid(doneByDay(doneAts, timeZone), today, weeks);
  const days = grid.cells.filter((c): c is Day => c !== null);
  const summary = `${grid.total} done in ${span}`;
  return (
    <section className="activity" aria-label="Done work">
      <p className="activity-head">
        <span className="total">{summary}</span>
        <span className="meta">{grid.today.count} today</span>
      </p>
      <HeatScroll>
        <span className="heat-corner" aria-hidden="true" />
        <div className="heat-months" aria-hidden="true">
          {grid.months.map((m, i) => (
            <span key={i}>{m ?? ""}</span>
          ))}
        </div>
        <div className="heat-days" aria-hidden="true">
          {DAY_LABELS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="heat" role="img" aria-label={`${summary}. Today: ${grid.today.count}.`}>
          {grid.cells.map((c, i) =>
            c === null ? (
              <i key={i} className="cell future" />
            ) : (
              <i
                key={i}
                className="cell"
                data-l={level(c.count)}
                data-today={c.date === today ? "" : undefined}
                title={`${dayName(c.date)}: ${c.count === 0 ? "nothing" : c.count} done`}
              />
            ),
          )}
        </div>
      </HeatScroll>
      <div className="activity-foot">
        <details className="numbers">
          <summary>Show as numbers</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Done</th>
              </tr>
            </thead>
            <tbody>
              {monthTotals(days).map((m) => (
                <tr key={m.month}>
                  <td>{m.month}</td>
                  <td>{m.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
        <span className="legend" aria-hidden="true">
          <span className="t">Fewer</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <i key={l} className="cell" data-l={l} />
          ))}
          <span className="t">More</span>
        </span>
      </div>
    </section>
  );
}

// The last 7 days as a small strip of squares, with the count in words for screen readers.
export function WeekStrip({ week }: { week: Day[] }) {
  const active = week.filter((d) => d.count > 0).length;
  return (
    <span className="strip" role="img" aria-label={`Last 7 days: done items on ${active} of 7 days`}>
      {week.map((d) => (
        <i key={d.date} className="cell" data-l={level(d.count)} title={`${dayName(d.date)}: ${d.count} done`} />
      ))}
    </span>
  );
}
