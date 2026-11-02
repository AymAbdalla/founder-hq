// Checks what someone typed into the project form, using the same limits as the database.
// Returns the cleaned values, or one plain-words message per problem.
export const PROJECT_STATUSES = ["active", "paused", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type ProjectInput = {
  name: string;
  kind: string | null;
  summary: string | null;
  notes: string | null;
  status: ProjectStatus;
};

// The fields the edit form changes. Status changes through its own buttons, so an edit never resets it.
export type ProjectFields = Omit<ProjectInput, "status">;

// Project addresses carry a UUID. Anything else is "not found" before any database call.
const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isProjectId(value: unknown): value is string {
  return typeof value === "string" && PROJECT_ID.test(value);
}

export type ProjectParse = { ok: true; value: ProjectInput } | { ok: false; problems: string[] };

export const NAME_MAX = 80;
export const KIND_MAX = 40;
export const SUMMARY_MAX = 200;
export const NOTES_MAX = 10000;

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === "string" && (PROJECT_STATUSES as readonly string[]).includes(value);
}

export function parseProjectInput(raw: Record<string, unknown>): ProjectParse {
  const problems: string[] = [];

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (name === "") problems.push("Give the project a name.");
  else if (name.length > NAME_MAX) problems.push(`Keep the name to ${NAME_MAX} characters or fewer.`);

  const optional = (field: "kind" | "summary" | "notes", max: number): string | null => {
    const value = raw[field];
    if (value === undefined || value === null) return null;
    if (typeof value !== "string") {
      problems.push(`The ${field} must be text.`);
      return null;
    }
    const text = value.trim();
    if (text.length > max) problems.push(`Keep the ${field} to ${max.toLocaleString("en-US")} characters or fewer.`);
    return text === "" ? null : text;
  };
  const kind = optional("kind", KIND_MAX);
  const summary = optional("summary", SUMMARY_MAX);
  const notes = optional("notes", NOTES_MAX);

  let status: ProjectStatus = "active";
  if (raw.status !== undefined && raw.status !== null && raw.status !== "") {
    if (isProjectStatus(raw.status)) status = raw.status;
    else problems.push("Choose active, paused or archived for the status.");
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, value: { name, kind, summary, notes, status } };
}
