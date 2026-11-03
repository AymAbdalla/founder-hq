// Checks what someone typed into the add box or the item form, using the same limits as the database.
// Returns the cleaned values, or one plain-words message per problem.
import { isDateString, isTimeString } from "@/lib/dates";
import { isProjectId } from "@/lib/projects/input";

export const ITEM_KINDS = ["todo", "reminder", "idea", "feature"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export const KIND_LABEL: Record<ItemKind, string> = { todo: "To-do", reminder: "Reminder", idea: "Idea", feature: "Feature" };
export const TITLE_MAX = 200;
export const ITEM_NOTES_MAX = 10000;

export function isItemKind(v: unknown): v is ItemKind {
  return typeof v === "string" && (ITEM_KINDS as readonly string[]).includes(v);
}

// Items use the same UUID rule as projects.
export function isItemId(v: unknown): v is string {
  return isProjectId(v);
}

export type ItemInput = {
  title: string;
  kind: ItemKind;
  notes: string | null;
  project_id: string | null;
  due_date: string | null;
  due_time: string | null;
};
export type ItemParse = { ok: true; value: ItemInput } | { ok: false; problems: string[] };

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function parseItemInput(raw: Record<string, unknown>, today: string): ItemParse {
  const problems: string[] = [];

  const title = text(raw.title);
  if (title === "") problems.push("Give the item a title.");
  else if (title.length > TITLE_MAX) problems.push(`Keep the title to ${TITLE_MAX} characters or fewer.`);

  let kind: ItemKind = "todo";
  if (raw.kind !== undefined && raw.kind !== null && raw.kind !== "") {
    if (isItemKind(raw.kind)) kind = raw.kind;
    else problems.push("Choose to-do, reminder, idea or feature.");
  }

  const notesText = text(raw.notes);
  if (notesText.length > ITEM_NOTES_MAX) problems.push("Keep the notes to 10,000 characters or fewer.");
  const notes = notesText === "" ? null : notesText;

  let project_id: string | null = null;
  if (raw.project !== undefined && raw.project !== null && raw.project !== "") {
    if (isProjectId(raw.project)) project_id = raw.project;
    else problems.push("Choose a project from the list.");
  }

  let due_date: string | null = null;
  const dateText = text(raw.date);
  if (dateText !== "") {
    if (isDateString(dateText)) due_date = dateText;
    else problems.push("Enter the date as a calendar date.");
  }

  let due_time: string | null = null;
  const timeText = text(raw.time);
  if (timeText !== "") {
    if (isTimeString(timeText)) due_time = timeText.slice(0, 5);
    else problems.push("Enter the time as hours and minutes.");
  }

  // A time without a date means today (spec P10).
  if (due_time !== null && due_date === null && dateText === "") due_date = today;

  if (kind === "reminder" && due_date === null && dateText === "") problems.push("A reminder needs a date.");

  return problems.length > 0 ? { ok: false, problems } : { ok: true, value: { title, kind, notes, project_id, due_date, due_time } };
}
