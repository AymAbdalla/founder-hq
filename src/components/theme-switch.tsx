"use client";

import { Icon } from "./icons";

// The theme choice lives in a plain cookie. The root layout reads it and puts data-theme
// on <html>, so the choice is there from the first paint after a reload. No inline script.
const COOKIE = "hq-theme";

function currentTheme(): "light" | "dark" {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeSwitch() {
  function flip() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  }
  return (
    <button type="button" className="icon-btn theme-btn" aria-label="Switch between light and dark mode" onClick={flip}>
      <Icon name="moon" />
      <Icon name="sun" />
    </button>
  );
}
